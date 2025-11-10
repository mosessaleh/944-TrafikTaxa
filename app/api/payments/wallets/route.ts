import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const revalidate = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").toLowerCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  const wallets = await prisma.cryptoWallet.findMany({
    where: { symbol, isActive: true },
    orderBy: [{ network: "asc" }],
  });
  return NextResponse.json({ wallets });
}
