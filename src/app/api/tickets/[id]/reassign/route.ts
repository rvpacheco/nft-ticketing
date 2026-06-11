import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Transferencia controlada: el promotor reasigna un ticket NO usado a
// otro email (cubre emails mal escritos y reventa off-chain).
//
// El mismo ticket vuelve a PENDING para el nuevo email y pasa de nuevo
// por claim + mint. El cNFT viejo NO se quema: Bubblegum exige la firma
// del dueno de la hoja (el comprador) para burn, y el server no la tiene
// — consecuencia real de que la wallet sea del usuario. El cNFT viejo
// queda invalidado logicamente: su QR ya no verifica (la wallet del
// ticket cambia) y el assetId registrado sera el nuevo.
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
  const newEmail = String(body?.newEmail ?? "").trim().toLowerCase();
  const reason = String(body?.reason ?? "").trim() || null;
  if (!EMAIL_RE.test(newEmail)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id, event: { promoterId: promoter.id } },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
  }
  if (ticket.status === "USED") {
    return NextResponse.json(
      { error: "Un ticket usado no se puede reasignar" },
      { status: 409 },
    );
  }
  if (ticket.buyerEmail === newEmail) {
    return NextResponse.json(
      { error: "El ticket ya pertenece a ese email" },
      { status: 409 },
    );
  }

  // Transaccion: el update condicional por status evita reasignar un
  // ticket que se canjeo entre el find y aqui
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
      { error: "El ticket se uso mientras se reasignaba" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
