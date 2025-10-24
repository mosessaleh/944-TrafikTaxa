
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
