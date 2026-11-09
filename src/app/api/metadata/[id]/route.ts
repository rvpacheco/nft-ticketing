import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// NFT metadata JSON (Metaplex standard). Public: the cNFT URI
// points here and explorers/wallets read it without auth.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: `${ticket.event.name} — ${ticket.tier}`,
    symbol: "TKT",
    description: `Ticket for ${ticket.event.name} at ${ticket.event.venue}`,
    attributes: [
      { trait_type: "event", value: ticket.event.name },
      { trait_type: "venue", value: ticket.event.venue },
      { trait_type: "date", value: ticket.event.startsAt.toISOString() },
      { trait_type: "tier", value: ticket.tier },
    ],
  });
}
