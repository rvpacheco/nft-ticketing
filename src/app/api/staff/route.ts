import { NextResponse } from "next/server";
import { getAuthedPromoter } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: Request) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const staff = await prisma.staff.findMany({
    where: { promoterId: promoter.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const promoter = await getAuthedPromoter(req);
  if (!promoter) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim() || null;
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  const staff = await prisma.staff.upsert({
    where: { promoterId_email: { promoterId: promoter.id, email } },
    update: { name },
    create: { promoterId: promoter.id, email, name },
  });
  return NextResponse.json(staff, { status: 201 });
}
