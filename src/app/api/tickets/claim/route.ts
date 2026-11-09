import { NextResponse } from "next/server";
import { getBuyerContext } from "@/lib/auth";
import { mintAssignedTicketsForEmail } from "@/lib/mint";
import { prisma } from "@/lib/prisma";

// Buyer onboarding: links their embedded wallet to all their
// PENDING tickets (they may have several, across events).
export async function POST(req: Request) {
  const buyer = await getBuyerContext(req);
  if (!buyer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!buyer.walletAddress) {
    // Privy creates the wallet right after login; the client retries.
    return NextResponse.json(
      { error: "Wallet not created yet, retry" },
      { status: 409 },
    );
  }

  const { count } = await prisma.ticket.updateMany({
    where: { buyerEmail: buyer.email, status: "PENDING" },
    data: { walletAddress: buyer.walletAddress, status: "ASSIGNED" },
  });

  // Mint the newly assigned ones (and any earlier ASSIGNED whose mint
  // failed). If a mint fails, the ticket stays ASSIGNED.
  const minted = await mintAssignedTicketsForEmail(buyer.email);

  return NextResponse.json({ claimed: count, minted });
}
