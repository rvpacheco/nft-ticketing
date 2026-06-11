import { prisma } from "./prisma";
import { mintTicketNft } from "./solana";

/**
 * Mintea un ticket ASSIGNED y lo pasa a MINTED con su assetId.
 * Devuelve el ticket actualizado, o null si no esta en condiciones.
 * Si el mint on-chain falla, lanza: el ticket queda en ASSIGNED y
 * se puede reintentar.
 */
export async function mintTicket(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { event: true },
  });
  if (!ticket || ticket.status !== "ASSIGNED" || !ticket.walletAddress) {
    return null;
  }

  const assetId = await mintTicketNft(ticket, ticket.event);

  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "MINTED", nftAssetId: assetId },
  });
}

/** Mintea en secuencia todos los tickets ASSIGNED de un email; no lanza. */
export async function mintAssignedTicketsForEmail(email: string) {
  const tickets = await prisma.ticket.findMany({
    where: { buyerEmail: email, status: "ASSIGNED" },
    select: { id: true },
  });
  let minted = 0;
  for (const { id } of tickets) {
    try {
      if (await mintTicket(id)) minted++;
    } catch (err) {
      console.error(`Mint fallo para ticket ${id}:`, err);
    }
  }
  return minted;
}
