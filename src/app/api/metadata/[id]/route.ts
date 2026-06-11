import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Metadata JSON del NFT (estandar Metaplex). Publica: la URI del cNFT
// apunta aqui y los explorers/wallets la leen sin auth.
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
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    name: `${ticket.event.name} — ${ticket.tier}`,
    symbol: "TKT",
    description: `Ticket para ${ticket.event.name} en ${ticket.event.venue}`,
    attributes: [
      { trait_type: "event", value: ticket.event.name },
      { trait_type: "venue", value: ticket.event.venue },
      { trait_type: "date", value: ticket.event.startsAt.toISOString() },
      { trait_type: "tier", value: ticket.tier },
    ],
  });
}
