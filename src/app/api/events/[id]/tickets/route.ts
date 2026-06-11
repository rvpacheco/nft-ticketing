import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const buyerEmail = String(body?.buyerEmail ?? "").trim().toLowerCase();
  const tier = String(body?.tier ?? "general").trim() || "general";
  if (!EMAIL_RE.test(buyerEmail)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: { id, promoterId: promoter.id },
    include: { _count: { select: { tickets: { where: { status: { not: "REVOKED" } } } } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }
  if (event._count.tickets >= event.capacity) {
    return NextResponse.json({ error: "Evento agotado (capacidad llena)" }, { status: 409 });
  }

  const ticket = await prisma.ticket.create({
    data: { eventId: event.id, buyerEmail, tier },
  });

  return NextResponse.json(ticket, { status: 201 });
}
