import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { redeemTicket } from "@/lib/redeem";
import type { QrPayload } from "@/lib/qr";

// Canje en puerta. Solo staff autenticado (promotor) puede escanear.
export async function POST(req: Request) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let payload: QrPayload;
  try {
    const body = await req.json();
    // El scanner manda el texto del QR tal cual (JSON string)
    payload = typeof body.qr === "string" ? JSON.parse(body.qr) : body.qr;
    if (
      typeof payload?.t !== "string" ||
      typeof payload?.e !== "number" ||
      typeof payload?.n !== "string" ||
      typeof payload?.s !== "string"
    ) {
      throw new Error("forma invalida");
    }
  } catch {
    return NextResponse.json(
      { granted: false, result: "TICKET_NOT_FOUND", message: "QR ilegible" },
      { status: 400 },
    );
  }

  const outcome = await redeemTicket(payload, promoter.email);
  return NextResponse.json(outcome, { status: outcome.granted ? 200 : 409 });
}
