import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Public endpoint: list available crypto symbols for checkout.
 * Tries DB (CryptoWallet with isActive=true). Falls back to a static set if DB isn't ready.
 * Response shape: { symbols: [{ symbol, total, active }...] }
 */
export async function GET() {
  try {
    const wallets = await prisma.cryptoWallet.findMany({
      where: { isActive: true },
      select: { symbol: true, isActive: true },
    });
    const map = new Map<string, { total: number; active: number }>();
    for (const w of wallets) {
      const key = String(w.symbol || "").toLowerCase();
      const rec = map.get(key) || { total: 0, active: 0 };
      rec.total += 1;
      if (w.isActive) rec.active += 1;
      map.set(key, rec);
    }
    const symbols = Array.from(map.entries())
      .filter(([, v]) => v.active > 0) // Only show symbols with active wallets
      .map(([symbol, v]) => ({
        id: symbol,
        label: symbol.toUpperCase(),
        total: v.total,
        active: v.active,
      }));
    return NextResponse.json({ symbols, source: "db" });
  } catch (_e) {
    // Fallback: common coins so UI doesn't break even if DB model isn't present
    const defaults = ["pi","btc","eth","usdt","usdc","bnb","xrp"].map(s => ({
      id: s, label: s.toUpperCase(), total: 1, active: 1
    }));
    return NextResponse.json({ symbols: defaults, source: "fallback" });
  }
}
