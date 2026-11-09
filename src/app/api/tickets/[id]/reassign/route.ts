import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Controlled transfer: the promoter reassigns an UNUSED ticket to
// another email (covers typos and off-chain resale).
//
// The same ticket goes back to PENDING for the new email and goes
// through claim + mint again. The old cNFT is NOT burned: Bubblegum requires
// the leaf owner's signature (the buyer) to burn, and the server doesn't have it
// — a real consequence of the wallet belonging to the user. The old cNFT
// is logically invalidated: its QR no longer verifies (the ticket's
// wallet changes) and the stored assetId will be the new one.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const newEmail = String(body?.newEmail ?? "").trim().toLowerCase();
  const reason = String(body?.reason ?? "").trim() || null;
  if (!EMAIL_RE.test(newEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, event: { promoterId: promoter.id } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (ticket.status === "USED") {
    return NextResponse.json(
      { error: "A used ticket cannot be reassigned" },
      { status: 409 },
    );
  }
  if (ticket.buyerEmail === newEmail) {
    return NextResponse.json(
      { error: "The ticket already belongs to that email" },
      { status: 409 },
    );
  }

  // Transaction: the status-conditional update avoids reassigning a
  // ticket that was redeemed between the find and here
  const [updated] = await prisma.$transaction(async (tx) => {
    const { count } = await tx.ticket.updateMany({
      where: { id: ticket.id, status: { not: "USED" } },
      data: {
        buyerEmail: newEmail,
        walletAddress: null,
        nftAssetId: null,
        status: "PENDING",
      },
    });
    if (count === 0) throw new Error("USED_RACE");
    const log = await tx.reassignmentLog.create({
      data: {
        ticketId: ticket.id,
        fromEmail: ticket.buyerEmail,
        toEmail: newEmail,
        oldNftAssetId: ticket.nftAssetId,
        reason,
      },
    });
    return [log];
  }).catch((err) => {
    if (err instanceof Error && err.message === "USED_RACE") return [null];
    throw err;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "The ticket was used while being reassigned" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
