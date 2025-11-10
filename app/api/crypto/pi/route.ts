import { NextResponse } from "next/server";

export const revalidate = 60; // cache up to 60s

type PriceResponse = {
  source: "coingecko-pro" | "coingecko-public";
  last_updated: string;
  vs: string[];
  data: Record<string, number>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vs = (url.searchParams.get("vs") || "usd,dkk").toLowerCase();
  const ids = "pi-network";
  const key = process.env.COINGECKO_API_KEY?.trim();

  const endpointBase = key
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";
  const endpoint = `${endpointBase}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`;

  const headers: HeadersInit = key ? { "x-cg-pro-api-key": key } : {};

  const res = await fetch(endpoint, { headers, // @ts-ignore
    next: { revalidate: 60 } 
  });

  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ error: txt || "Failed to fetch price" }, { status: res.status });
  }
  const json = await res.json();
  const entry = json?.["pi-network"] || {};

  const out: PriceResponse = {
    source: key ? "coingecko-pro" : "coingecko-public",
    last_updated: new Date().toISOString(),
    vs: vs.split(",").map(s => s.trim()).filter(Boolean),
    data: entry
  };

  return NextResponse.json(out, { status: 200 });
}
