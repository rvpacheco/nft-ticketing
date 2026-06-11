import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { promoterId: promoter.id },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { tickets: true } } },
  });

  return NextResponse.json(events);
}

export async function POST(req: Request) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { name, venue, startsAt, capacity } = body ?? {};
  if (!name || !venue || !startsAt || !Number.isInteger(capacity) || capacity < 1) {
    return NextResponse.json(
      { error: "Campos requeridos: name, venue, startsAt, capacity (entero > 0)" },
      { status: 400 },
    );
  }
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "startsAt invalida" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: { promoterId: promoter.id, name, venue, startsAt: date, capacity },
  });

  return NextResponse.json(event, { status: 201 });
}
