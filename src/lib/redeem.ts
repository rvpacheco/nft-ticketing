import bs58 from "bs58";
import nacl from "tweetnacl";
import type { RedemptionResult } from "@/generated/prisma/enums";
import { getAssetOwner } from "./das";
import { prisma } from "./prisma";
import { QR_CLOCK_SKEW_MS, qrMessage, type QrPayload } from "./qr";

export type RedeemOutcome = {
  granted: boolean;
  result: RedemptionResult;
  /** Mensaje para mostrar en el scanner */
  message: string;
  /** Datos del ticket para que el portero confirme visualmente */
  ticket?: { buyerEmail: string; tier: string; eventName: string };
  chainCheckSkipped: boolean;
};

/**
 * Cadena de verificacion del QR de entrada. Orden:
 *  1. ticket existe y esta en un estado canjeable
 *  2. el scanner es promotor/staff del evento del ticket
 *  3. QR no expirado (con margen por relojes)
 *  4. firma ed25519 valida de la wallet del ticket
 *  5. ownership on-chain via DAS (tolerante a timeout: skip + log)
 *  6. update atomico MINTED -> USED (imposible doble entrada)
 * Todos los intentos quedan en RedemptionLog.
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

  // Sin ticket no hay FK para loguear; respuesta directa.
  if (!ticket || ticket.status === "REVOKED") {
    return {
      granted: false,
      result: "TICKET_NOT_FOUND",
      message: ticket ? "Ticket anulado" : "Ticket inexistente",
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

  // 2. El scanner debe ser promotor/staff del evento de ESTE ticket
  if (!allowedPromoterIds.includes(ticket.event.promoterId)) {
    return finish(
      "NOT_AUTHORIZED",
      "No estas autorizado para este evento",
    );
  }

  if (ticket.status === "PENDING" || ticket.status === "ASSIGNED") {
    return finish("TICKET_NOT_FOUND", "El ticket aun no tiene NFT emitido");
  }

  // 2. Expiracion
  if (payload.e + QR_CLOCK_SKEW_MS < Date.now()) {
    return finish("EXPIRED_QR", "QR vencido — pide que recargue la pantalla");
  }

  // 3. Firma de la wallet del comprador
  if (!ticket.walletAddress) {
    return finish("INVALID_SIGNATURE", "Ticket sin wallet asociada");
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

  // 4. Ownership on-chain (tolerante a fallos del indexer)
  let chainCheckSkipped = false;
  if (ticket.nftAssetId) {
    const owner = await getAssetOwner(ticket.nftAssetId);
    if (owner === null) {
      chainCheckSkipped = true;
    } else if (owner !== ticket.walletAddress) {
      return finish(
        "OWNERSHIP_MISMATCH",
        "El NFT ya no pertenece a esta wallet",
      );
    }
  } else {
    chainCheckSkipped = true;
  }

  // 5. Canje atomico: solo una request puede ganar esta transicion
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: "MINTED" },
    data: { status: "USED" },
  });
  if (count === 0) {
    return finish("ALREADY_USED", "Ticket YA USADO", chainCheckSkipped);
  }

  return finish("GRANTED", "Entrada concedida", chainCheckSkipped);
}
