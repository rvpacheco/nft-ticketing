import { NextResponse } from "next/server";
import { getBuyerContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const buyer = await getBuyerContext(req);
  if (!buyer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tickets = await prisma.ticket.findMany({
    where: { buyerEmail: buyer.email, status: { not: "REVOKED" } },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { name: true, venue: true, startsAt: true } },
    },
  });

  return NextResponse.json(tickets);
}
