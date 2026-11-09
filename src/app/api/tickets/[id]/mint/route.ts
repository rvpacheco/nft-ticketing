import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { mintTicket } from "@/lib/mint";
import { prisma } from "@/lib/prisma";

// Manual mint retry by the promoter (for ASSIGNED tickets
// whose automatic mint failed).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findFirst({
    where: { id, event: { promoterId: promoter.id } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.status !== "ASSIGNED") {
    return NextResponse.json(
      { error: `Ticket is ${ticket.status}, it can only be minted from ASSIGNED` },
      { status: 409 },
    );
  }

  try {
    const updated = await mintTicket(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error(`Manual mint failed for ticket ${id}:`, err);
    return NextResponse.json(
      { error: "Mint failed, check the server wallet balance and retry" },
      { status: 502 },
    );
  }
}
