import { NextResponse } from "next/server";
import { privy, verifyRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Upsert del promotor tras login: crea su fila la primera vez que entra.
export async function POST(req: Request) {
  const claims = await verifyRequest(req);
  if (!claims) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await privy.getUserById(claims.userId);
  const email = user.email?.address;
  if (!email) {
    return NextResponse.json(
      { error: "La cuenta de Privy no tiene email" },
      { status: 400 },
    );
  }

  const promoter = await prisma.promoter.upsert({
    where: { privyUserId: claims.userId },
    update: { email },
    create: { privyUserId: claims.userId, email },
  });

  return NextResponse.json(promoter);
}
