
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type Params = { params: { symbol: string } };

export async function PUT(request: Request, { params }: Params) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const active = Boolean(body?.active);
  const symbol = params.symbol.toLowerCase();
  await prisma.cryptoWallet.updateMany({
    where: { symbol },
    data: { isActive: active }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const symbol = params.symbol.toLowerCase();
  await prisma.cryptoWallet.deleteMany({ where: { symbol } });
  return NextResponse.json({ ok: true });
}
