import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, promoterId: promoter.id },
    include: { tickets: { orderBy: { createdAt: "desc" } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  return NextResponse.json(event);
}
