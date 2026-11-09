// Redemption concurrency test: two simultaneous scans of the same QR
// must leave exactly ONE GRANTED and one ALREADY_USED (risk #4 of the
// plan). Also covers an expired QR, an invalid signature and unauthorized staff.
// Creates test data in the DB and cleans it up at the end.
// Uso: npx tsx scripts/test-double-scan.ts
import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { prisma } from "../src/lib/prisma";
import { redeemTicket } from "../src/lib/redeem";
import { QR_TTL_MS, qrMessage, type QrPayload } from "../src/lib/qr";

let failures = 0;
function check(cond: boolean, label: string) {
  console.log(`${cond ? "OK " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

function signedPayload(ticketId: string, buyer: Keypair, exp?: number): QrPayload {
  const e = exp ?? Date.now() + QR_TTL_MS;
  const n = crypto.randomUUID();
  const sig = nacl.sign.detached(
    new TextEncoder().encode(qrMessage(ticketId, e, n)),
    buyer.secretKey,
  );
  return { t: ticketId, e, n, s: bs58.encode(sig) };
}

async function main() {
  const buyer = Keypair.generate();
  const promoter = await prisma.promoter.create({
    data: {
      privyUserId: `test-${Date.now()}`,
      email: `test-${Date.now()}@test.local`,
    },
  });
  const event = await prisma.event.create({
    data: {
      promoterId: promoter.id,
      name: "Concurrency test event",
      venue: "test",
      startsAt: new Date(),
      capacity: 10,
    },
  });

  const makeTicket = () =>
    prisma.ticket.create({
      data: {
        eventId: event.id,
        buyerEmail: "buyer@test.local",
        walletAddress: buyer.publicKey.toBase58(),
        status: "MINTED",
        // no nftAssetId: the on-chain check is skipped (chainCheckSkipped)
      },
    });

  try {
    // 1. Doble scan concurrente: exactamente uno gana
    const t1 = await makeTicket();
    const payload = signedPayload(t1.id, buyer);
    const [a, b] = await Promise.all([
      redeemTicket(payload, "scanner-A@test.local", [promoter.id]),
      redeemTicket(payload, "scanner-B@test.local", [promoter.id]),
    ]);
    const granted = [a, b].filter((r) => r.result === "GRANTED").length;
    const alreadyUsed = [a, b].filter((r) => r.result === "ALREADY_USED").length;
    check(granted === 1, `concurrent double scan: 1 GRANTED (got ${granted})`);
    check(alreadyUsed === 1, `concurrent double scan: 1 ALREADY_USED (got ${alreadyUsed})`);

    // 2. Re-scan posterior: ALREADY_USED
    const c = await redeemTicket(signedPayload(t1.id, buyer), "scanner-A@test.local", [promoter.id]);
    check(c.result === "ALREADY_USED", `later re-scan: ALREADY_USED (got ${c.result})`);

    // 3. QR vencido
    const t2 = await makeTicket();
    const expired = signedPayload(t2.id, buyer, Date.now() - 60_000);
    const d = await redeemTicket(expired, "scanner-A@test.local", [promoter.id]);
    check(d.result === "EXPIRED_QR", `expired QR: EXPIRED_QR (got ${d.result})`);

    // 4. Signature from another wallet
    const impostor = Keypair.generate();
    const forged = signedPayload(t2.id, impostor);
    const e2 = await redeemTicket(forged, "scanner-A@test.local", [promoter.id]);
    check(e2.result === "INVALID_SIGNATURE", `foreign signature: INVALID_SIGNATURE (got ${e2.result})`);

    // 5. Scanner from another promoter
    const f = await redeemTicket(signedPayload(t2.id, buyer), "scanner-X@test.local", ["otro-promoter-id"]);
    check(f.result === "NOT_AUTHORIZED", `foreign staff: NOT_AUTHORIZED (got ${f.result})`);

    // 6. The valid ticket stays redeemable after the failed attempts
    const g = await redeemTicket(signedPayload(t2.id, buyer), "scanner-A@test.local", [promoter.id]);
    check(g.result === "GRANTED", `legit redemption after rejections: GRANTED (got ${g.result})`);
  } finally {
    // Cleanup in FK order
    await prisma.redemptionLog.deleteMany({ where: { ticket: { eventId: event.id } } });
    await prisma.ticket.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.promoter.delete({ where: { id: promoter.id } });
  }

  console.log(failures === 0 ? "\nAll OK" : `\n${failures} fallas`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
