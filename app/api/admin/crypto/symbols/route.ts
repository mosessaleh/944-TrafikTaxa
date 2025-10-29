
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  console.log('GET /api/admin/crypto/symbols called');
  const me = await getUserFromCookie();
  console.log('User in symbols:', me);
  if (!me) {
    console.log('Forbidden: no user');
    return NextResponse.json({ error: "forbidden - no user" }, { status: 403 });
  }
  if (me.role !== "ADMIN") {
    console.log('Forbidden: user not admin, role:', me.role);
    return NextResponse.json({ error: "forbidden - not admin" }, { status: 403 });
  }
  const wallets = await prisma.cryptoWallet.findMany({
    select: { symbol: true, isActive: true }
  });
  const map = new Map<string, { total: number; active: number }>();
  for (const w of wallets) {
    const key = w.symbol.toLowerCase();
    const e = map.get(key) || { total: 0, active: 0 };
    e.total += 1;
    if (w.isActive) e.active += 1;
    map.set(key, e);
  }
  const symbols = Array.from(map.entries()).map(([symbol, v]) => ({ symbol, total: v.total, active: v.active }));
  return NextResponse.json({ symbols });
}
