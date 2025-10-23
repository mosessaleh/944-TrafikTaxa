"use client";
import useSWR from "swr";

async function fetcher(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function PriceGrid({ title, usd, dkk, updated }: { title: string; usd?: number; dkk?: number; updated?: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-5">
          <div className="text-sm text-gray-500">Price (USD)</div>
          <div className="text-3xl font-semibold">{usd !== undefined ? `$${usd}` : "—"}</div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="text-sm text-gray-500">Price (DKK)</div>
          <div className="text-3xl font-semibold">{dkk !== undefined ? `${dkk} kr` : "—"}</div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="text-sm text-gray-500">Last Updated</div>
          <div className="text-xl">{updated ? new Date(updated).toLocaleString() : "—"}</div>
        </div>
      </div>
    </section>
  );
}

export default function AdminPiPricePage() {
  // PI (pi-network)
  const { data: piData, error: piError, isLoading: piLoading } = useSWR(
    "/api/crypto/pi?vs=usd,dkk",
    fetcher,
    { refreshInterval: 60_000 }
  );

  // USDT / USDC / BTC
  const { data: tickers, error: tError, isLoading: tLoading } = useSWR(
    "/api/crypto/tickers?ids=tether,usd-coin,bitcoin&vs=usd,dkk",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const source = piData?.source || tickers?.source || "—";

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Crypto Prices</h1>
        <p className="text-sm text-gray-500">Auto-refresh every 60s • Source: {source}</p>
      </div>

      {/* Pi */}
      {piLoading && (
        <div className="animate-pulse p-4 rounded-xl border">
          <div className="h-6 w-48 mb-2 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
      )}
      {piError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          Failed to load Pi price. {String(piError)}
        </div>
      )}
      {!piLoading && !piError && (
        <PriceGrid
          title="Pi (PI)"
          usd={piData?.data?.usd}
          dkk={piData?.data?.dkk}
          updated={piData?.last_updated}
        />
      )}

      {/* USDT / USDC / BTC with the SAME 3-box layout each */}
      {tLoading && (
        <div className="animate-pulse p-4 rounded-xl border">
          <div className="h-6 w-48 mb-2 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
        </div>
      )}
      {tError && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">
          Failed to load tickers. {String(tError)}
        </div>
      )}
      {!tLoading && !tError && (
        <div className="space-y-6">
          <PriceGrid
            title="USDT"
            usd={tickers?.data?.tether?.usd}
            dkk={tickers?.data?.tether?.dkk}
            updated={tickers?.last_updated}
          />
          <PriceGrid
            title="USDC"
            usd={tickers?.data?.["usd-coin"]?.usd}
            dkk={tickers?.data?.["usd-coin"]?.dkk}
            updated={tickers?.last_updated}
          />
          <PriceGrid
            title="BTC"
            usd={tickers?.data?.bitcoin?.usd}
            dkk={tickers?.data?.bitcoin?.dkk}
            updated={tickers?.last_updated}
          />
        </div>
      )}

      <div className="text-sm text-gray-500">
        CoinGecko public API has rate limits. Add <code>COINGECKO_API_KEY</code> in <code>.env</code> to use Pro endpoint.
      </div>
    </div>
  );
}
