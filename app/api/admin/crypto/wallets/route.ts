
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normalizeSymbol, getNetworks } from "@/lib/crypto";

export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const symbol = String(body?.symbol || "").toLowerCase();
  const network = String(body?.network || "");
  const address = String(body?.address || "");
  if (!symbol || !address || !network) {
    return NextResponse.json({ error: "symbol, network, address are required" }, { status: 400 });
  }
  const norm = normalizeSymbol(symbol);
  if (!norm) {
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }
  const networks = getNetworks(norm);
  if (!networks.includes(network)) {
    return NextResponse.json({ error: "Unsupported network for this symbol" }, { status: 400 });
  }

  const w = await prisma.cryptoWallet.create({
    data: { symbol: norm, network, address, isActive: true }
  });
  return NextResponse.json({ ok: true, wallet: { id: w.id } });
}
