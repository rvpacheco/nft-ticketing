import bs58 from "bs58";
import nacl from "tweetnacl";
import type { RedemptionResult } from "@/generated/prisma/enums";
import { getAssetOwner } from "./das";
import { prisma } from "./prisma";
import { QR_CLOCK_SKEW_MS, qrMessage, type QrPayload } from "./qr";

export type RedeemOutcome = {
  granted: boolean;
  result: RedemptionResult;
  /** Message to show on the scanner */
  message: string;
  /** Ticket data so door staff can confirm visually */
  ticket?: { buyerEmail: string; tier: string; eventName: string };
  chainCheckSkipped: boolean;
};

/**
 * Entry QR verification chain. Order:
 *  1. ticket exists and is in a redeemable state
 *  2. the scanner is promoter/staff for the ticket's event
 *  3. QR not expired (with clock-skew margin)
 *  4. valid ed25519 signature from the ticket's wallet
 *  5. on-chain ownership via DAS (timeout-tolerant: skip + log)
 *  6. atomic update MINTED -> USED (double entry impossible)
 * Every attempt is recorded in RedemptionLog.
 */
export async function redeemTicket(
  payload: QrPayload,
  scannerId: string,
  allowedPromoterIds: string[],
): Promise<RedeemOutcome> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: payload.t },
    include: { event: { select: { name: true, promoterId: true } } },
  });

  // Without a ticket there's no FK to log against; respond directly.
  if (!ticket || ticket.status === "REVOKED") {
    return {
      granted: false,
      result: "TICKET_NOT_FOUND",
      message: ticket ? "Ticket revoked" : "Ticket does not exist",
      chainCheckSkipped: false,
    };
  }

  const info = {
    buyerEmail: ticket.buyerEmail,
    tier: ticket.tier,
    eventName: ticket.event.name,
  };

  const finish = async (
    result: RedemptionResult,
    message: string,
    chainCheckSkipped = false,
  ): Promise<RedeemOutcome> => {
    await prisma.redemptionLog.create({
      data: { ticketId: ticket.id, scannerId, result, chainCheckSkipped },
    });
    return {
      granted: result === "GRANTED",
      result,
      message,
      ticket: info,
      chainCheckSkipped,
    };
  };

  // 2. The scanner must be promoter/staff for THIS ticket's event
  if (!allowedPromoterIds.includes(ticket.event.promoterId)) {
    return finish(
      "NOT_AUTHORIZED",
      "You are not authorized for this event",
    );
  }

  if (ticket.status === "PENDING" || ticket.status === "ASSIGNED") {
    return finish("TICKET_NOT_FOUND", "The ticket has no NFT issued yet");
  }

  // 2. Expiry
  if (payload.e + QR_CLOCK_SKEW_MS < Date.now()) {
    return finish("EXPIRED_QR", "QR expired — ask them to reload the screen");
  }

  // 3. Buyer wallet signature
  if (!ticket.walletAddress) {
    return finish("INVALID_SIGNATURE", "Ticket has no linked wallet");
  }
  let signatureOk = false;
  try {
    signatureOk = nacl.sign.detached.verify(
      new TextEncoder().encode(qrMessage(payload.t, payload.e, payload.n)),
      bs58.decode(payload.s),
      bs58.decode(ticket.walletAddress),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) {
    return finish("INVALID_SIGNATURE", "Firma invalida — QR no autentico");
  }

  // 4. On-chain ownership (tolerant of indexer failures)
  let chainCheckSkipped = false;
  if (ticket.nftAssetId) {
    const owner = await getAssetOwner(ticket.nftAssetId);
    if (owner === null) {
      chainCheckSkipped = true;
    } else if (owner !== ticket.walletAddress) {
      return finish(
        "OWNERSHIP_MISMATCH",
        "The NFT no longer belongs to this wallet",
      );
    }
  } else {
    chainCheckSkipped = true;
  }

  // 5. Atomic redemption: only one request can win this transition
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "MINTED" },
    data: { status: "USED" },
  });
  if (count === 0) {
    return finish("ALREADY_USED", "Ticket ALREADY USED", chainCheckSkipped);
  }

  return finish("GRANTED", "Entry granted", chainCheckSkipped);
}
