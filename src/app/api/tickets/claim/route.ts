import { NextResponse } from "next/server";
import { getBuyerContext } from "@/lib/auth";
import { mintAssignedTicketsForEmail } from "@/lib/mint";
import { prisma } from "@/lib/prisma";

// Onboarding del comprador: asocia su wallet embebida a todos sus
// tickets PENDING (puede tener varios, de distintos eventos).
export async function POST(req: Request) {
  const buyer = await getBuyerContext(req);
  if (!buyer) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!buyer.walletAddress) {
    // Privy crea la wallet justo despues del login; el cliente reintenta.
    return NextResponse.json(
      { error: "Wallet aun no creada, reintenta" },
      { status: 409 },
    );
  }

  const { count } = await prisma.ticket.updateMany({
    where: { buyerEmail: buyer.email, status: "PENDING" },
    data: { walletAddress: buyer.walletAddress, status: "ASSIGNED" },
  });

  // Mintea los recien asignados (y cualquier ASSIGNED previo cuyo mint
  // haya fallado). Si un mint falla, el ticket queda en ASSIGNED.
  const minted = await mintAssignedTicketsForEmail(buyer.email);

  return NextResponse.json({ claimed: count, minted });
}
