import { NextResponse } from "next/server";
import { getScannerContext } from "@/lib/auth";
import { redeemTicket } from "@/lib/redeem";
import type { QrPayload } from "@/lib/qr";

// Door redemption. Only promoters or registered staff can scan.
export async function POST(req: Request) {
  const scanner = await getScannerContext(req);
  if (!scanner) {
    return NextResponse.json(
      {
        granted: false,
        result: "NOT_AUTHORIZED",
        message: "Your email is not registered as staff for any event",
      },
      { status: 403 },
    );
  }

  let payload: QrPayload;
  try {
    const body = await req.json();
    // The scanner sends the QR text as-is (JSON string)
    payload = typeof body.qr === "string" ? JSON.parse(body.qr) : body.qr;
    if (
      typeof payload?.t !== "string" ||
      typeof payload?.e !== "number" ||
      typeof payload?.n !== "string" ||
      typeof payload?.s !== "string"
    ) {
      throw new Error("invalid shape");
    }
  } catch {
    return NextResponse.json(
      { granted: false, result: "TICKET_NOT_FOUND", message: "Unreadable QR" },
      { status: 400 },
    );
  }

  const outcome = await redeemTicket(
    payload,
    scanner.scannerId,
    scanner.promoterIds,
  );
  return NextResponse.json(outcome, { status: outcome.granted ? 200 : 409 });
}
