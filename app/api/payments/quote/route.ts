import { NextResponse } from "next/server";

const mapSymbolToId: Record<string, string> = {
  usdt: "tether",
  usdc: "usd-coin",
  btc: "bitcoin",
  pi: "pi-network",
};

export const revalidate = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "usdt").toLowerCase();
  const amountDkk = Number(url.searchParams.get("amount_dkk") || "0");
  if (!amountDkk || amountDkk <= 0) {
    return NextResponse.json({ error: "amount_dkk must be > 0" }, { status: 400 });
  }

  const id = mapSymbolToId[symbol];
  if (!id) {
    return NextResponse.json({ error: "Unsupported symbol" }, { status: 400 });
  }

  // Fetch price in DKK for the symbol
  let priceDkk: number | undefined;
  if (symbol === "pi") {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/crypto/pi?vs=dkk`, { cache: "no-store" });
    const json = await res.json();
    priceDkk = json?.data?.dkk;
  } else {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/crypto/tickers?ids=${id}&vs=dkk`, { cache: "no-store" });
    const json = await res.json();
    priceDkk = json?.data?.[id]?.dkk;
  }

  if (typeof priceDkk !== "number" || priceDkk <= 0) {
    return NextResponse.json({ error: "Failed to get price" }, { status: 502 });
  }

  const amountCoin = amountDkk / priceDkk;
  const out = {
    symbol,
    amountDkk,
    priceDkk,
    amountCoin,
    last_updated: new Date().toISOString(),
  };
  return NextResponse.json(out);
}
