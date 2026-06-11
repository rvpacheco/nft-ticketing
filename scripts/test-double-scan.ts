// Test de concurrencia del canje: dos scans simultaneos del mismo QR
// deben dejar exactamente UN GRANTED y un ALREADY_USED (riesgo #4 del
// plan). Tambien cubre QR vencido, firma invalida y staff no autorizado.
// Crea datos de prueba en la DB y los limpia al final.
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
      name: "Evento de prueba concurrencia",
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
        // sin nftAssetId: el check on-chain se salta (chainCheckSkipped)
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
    check(granted === 1, `doble-scan concurrente: 1 GRANTED (hubo ${granted})`);
    check(alreadyUsed === 1, `doble-scan concurrente: 1 ALREADY_USED (hubo ${alreadyUsed})`);

    // 2. Re-scan posterior: ALREADY_USED
    const c = await redeemTicket(signedPayload(t1.id, buyer), "scanner-A@test.local", [promoter.id]);
    check(c.result === "ALREADY_USED", `re-scan posterior: ALREADY_USED (fue ${c.result})`);

    // 3. QR vencido
    const t2 = await makeTicket();
    const expired = signedPayload(t2.id, buyer, Date.now() - 60_000);
    const d = await redeemTicket(expired, "scanner-A@test.local", [promoter.id]);
    check(d.result === "EXPIRED_QR", `QR vencido: EXPIRED_QR (fue ${d.result})`);

    // 4. Firma de otra wallet
    const impostor = Keypair.generate();
    const forged = signedPayload(t2.id, impostor);
    const e2 = await redeemTicket(forged, "scanner-A@test.local", [promoter.id]);
    check(e2.result === "INVALID_SIGNATURE", `firma ajena: INVALID_SIGNATURE (fue ${e2.result})`);

    // 5. Scanner de otro promotor
    const f = await redeemTicket(signedPayload(t2.id, buyer), "scanner-X@test.local", ["otro-promoter-id"]);
    check(f.result === "NOT_AUTHORIZED", `staff ajeno: NOT_AUTHORIZED (fue ${f.result})`);

    // 6. El ticket valido sigue canjeable tras los intentos fallidos
    const g = await redeemTicket(signedPayload(t2.id, buyer), "scanner-A@test.local", [promoter.id]);
    check(g.result === "GRANTED", `canje legitimo tras rechazos: GRANTED (fue ${g.result})`);
  } finally {
    // Limpieza en orden por FKs
    await prisma.redemptionLog.deleteMany({ where: { ticket: { eventId: event.id } } });
    await prisma.ticket.deleteMany({ where: { eventId: event.id } });
    await prisma.event.delete({ where: { id: event.id } });
    await prisma.promoter.delete({ where: { id: promoter.id } });
  }

  console.log(failures === 0 ? "\nTodo OK" : `\n${failures} fallas`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
