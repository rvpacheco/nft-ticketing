import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { mintTicket } from "@/lib/mint";
import { prisma } from "@/lib/prisma";

// Reintento manual de mint por el promotor (para tickets ASSIGNED
// cuyo mint automatico fallo).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findFirst({
    where: { id, event: { promoterId: promoter.id } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.status !== "ASSIGNED") {
    return NextResponse.json(
      { error: `El ticket esta en ${ticket.status}, solo se mintea desde ASSIGNED` },
      { status: 409 },
    );
  }

  try {
    const updated = await mintTicket(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`Mint manual fallo para ticket ${id}:`, err);
    return NextResponse.json(
      { error: "El mint fallo, revisa el balance del server wallet y reintenta" },
      { status: 502 },
    );
  }
}
