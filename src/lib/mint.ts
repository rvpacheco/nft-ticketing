import { prisma } from "./prisma";
import { mintTicketNft } from "./solana";

/**
 * Mints an ASSIGNED ticket and moves it to MINTED with its assetId.
 * Returns the updated ticket, or null if it isn't eligible.
 * If the on-chain mint fails, it throws: the ticket stays ASSIGNED and
 * can be retried.
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

/** Mints all ASSIGNED tickets for an email in sequence; never throws. */
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
      console.error(`Mint failed for ticket ${id}:`, err);
    }
  }
  return minted;
}
