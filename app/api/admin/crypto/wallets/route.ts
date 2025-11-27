
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { normalizeSymbol, getNetworks } from "@/lib/crypto";

export async function GET() {
  console.log('GET /api/admin/crypto/wallets called');
  const me = await getUserFromCookie();
  console.log('User:', me);
  if (!me) {
    console.log('Forbidden: no user');
    return NextResponse.json({ error: "forbidden - no user" }, { status: 403 });
  }
  if (me.type !== 'user' || (me as any).role !== "ADMIN") {
    console.log('Forbidden: user not admin, role:', (me as any).role);
    return NextResponse.json({ error: "forbidden - not admin" }, { status: 403 });
  }
  const wallets = await prisma.cryptoWallet.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ wallets });
}

export async function POST(request: Request) {
  console.log('POST /api/admin/crypto/wallets called');
  const me = await getUserFromCookie();
  console.log('User:', me);
  if (!me) {
    console.log('Forbidden: no user');
    return NextResponse.json({ error: "forbidden - no user" }, { status: 403 });
  }
  console.log('Role check: me.role =', (me as any).role, 'expected ADMIN');
  if (me.type !== 'user' || (me as any).role !== "ADMIN") {
    console.log('Forbidden: user not admin, role:', (me as any).role);
    return NextResponse.json({ error: "forbidden - not admin" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  console.log('Request body:', body);
  const symbol = String(body?.symbol || "").toLowerCase();
  const network = String(body?.network || "");
  const address = String(body?.address || "");
  console.log('Parsed data:', { symbol, network, address });
  if (!symbol || !address || !network) {
    console.log('Missing required fields');
    return NextResponse.json({ error: "symbol, network, address are required" }, { status: 400 });
  }
  const norm = normalizeSymbol(symbol);
  console.log('Normalized symbol:', norm);
  if (!norm) {
    console.log('Unsupported symbol');
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }
  const networks = getNetworks(norm);
  console.log('Available networks:', networks);
  if (!networks.includes(network)) {
    console.log('Unsupported network for symbol');
    return NextResponse.json({ error: "Unsupported network for this symbol" }, { status: 400 });
  }

  console.log('Creating wallet...');
  const w = await prisma.cryptoWallet.create({
    data: { symbol: norm, network, address, isActive: true }
  });
  console.log('Wallet created:', w);
  return NextResponse.json({ ok: true, wallet: { id: w.id } });
}
