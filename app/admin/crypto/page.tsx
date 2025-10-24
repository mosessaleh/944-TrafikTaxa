
"use client";
import useSWR, { mutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import { SYMBOLS, getCoinGeckoId, getNetworks } from "@/lib/crypto";

type SymbolRow = { symbol: string; total: number; active: number };
type SymbolsResp = { symbols: SymbolRow[] };
type PricesResp = { source: string; last_updated: string; vs: string[]; data: Record<string, { usd?: number; dkk?: number }> };

async function fetcher(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function Modal({ open, onClose, children }:{ open:boolean; onClose:()=>void; children: React.ReactNode }){
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6" onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function AdminCryptoPage(){
  const { data: symData, error: symErr, isLoading: symLoading } = useSWR<SymbolsResp>("/api/admin/crypto/symbols", fetcher, { refreshInterval: 30_000 });
  const [selected, setSelected] = useState<string | null>(null);

  const ids = useMemo(()=>{
    const list = (symData?.symbols || []).map(s => getCoinGeckoId(s.symbol)).filter(Boolean) as string[];
    const unique = Array.from(new Set(list));
    return unique.join(",");
  }, [symData]);

  const { data: prices } = useSWR<PricesResp>(ids ? `/api/crypto/tickers?ids=${encodeURIComponent(ids)}&vs=usd,dkk` : null, fetcher, { refreshInterval: 60_000 });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const [newSymbol, setNewSymbol] = useState<string>("usdt");
  const [newNetwork, setNewNetwork] = useState<string>("TRC20");
  const [newAddress, setNewAddress] = useState<string>("");

  useEffect(()=>{
    const nets = getNetworks(newSymbol);
    if (nets.length) setNewNetwork(nets[0]);
  }, [newSymbol]);

  const rows = (symData?.symbols || []).sort((a,b)=>a.symbol.localeCompare(b.symbol));

  const priceOf = (symbol: string) => {
    const id = getCoinGeckoId(symbol);
    if (!id) return { usd: undefined, dkk: undefined };
    const row = (prices?.data as any)?.[id] || {};
    return { usd: row.usd, dkk: row.dkk };
  };

  async function addCurrency(){
    const res = await fetch("/api/admin/crypto/wallets", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ symbol: newSymbol, network: newNetwork, address: newAddress })
    });
    if (!res.ok){ alert(await res.text()); return; }
    setAddOpen(false); setNewAddress("");
    mutate("/api/admin/crypto/symbols");
  }

  async function setActive(active:boolean){
    if (!selected) return;
    const res = await fetch(`/api/admin/crypto/symbols/${encodeURIComponent(selected)}`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ active })
    });
    if (!res.ok){ alert(await res.text()); return; }
    setEditOpen(false);
    mutate("/api/admin/crypto/symbols");
  }

  async function deleteSymbol(){
    if (!selected) return;
    const res = await fetch(`/api/admin/crypto/symbols/${encodeURIComponent(selected)}`, { method: "DELETE" });
    if (!res.ok){ alert(await res.text()); return; }
    setDelOpen(false); setSelected(null);
    mutate("/api/admin/crypto/symbols");
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Crypto — Wallets & Prices</h1>
        <p className="text-sm text-gray-500">Source: {prices?.source || "—"} • Last: {prices?.last_updated ? new Date(prices.last_updated).toLocaleString() : "—"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded-xl border" onClick={()=>setAddOpen(true)}>Add</button>
        <button className="px-3 py-2 rounded-xl border disabled:opacity-40" disabled={!selected} onClick={()=>setEditOpen(true)}>Edit</button>
        <button className="px-3 py-2 rounded-xl border disabled:opacity-40" disabled={!selected} onClick={()=>setDelOpen(true)}>Delete</button>
      </div>

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Coin</th>
              <th className="px-4 py-3 text-left">Price (USD)</th>
              <th className="px-4 py-3 text-left">Price (DKK)</th>
              <th className="px-4 py-3 text-left">All wallets</th>
            </tr>
          </thead>
          <tbody>
            {symLoading && (
              <tr><td className="px-4 py-3" colSpan={4}>Loading...</td></tr>
            )}
            {symErr && (
              <tr><td className="px-4 py-3 text-red-600" colSpan={4}>Failed to load symbols.</td></tr>
            )}
            {!symLoading && !symErr && rows.map(row => {
              const p = priceOf(row.symbol);
              const isSelected = selected === row.symbol;
              return (
                <tr key={row.symbol} className={`border-t ${isSelected ? "bg-blue-50" : ""}`} onClick={()=>setSelected(row.symbol)}>
                  <td className="px-4 py-3 font-semibold">{row.symbol.toUpperCase()}</td>
                  <td className="px-4 py-3">{p.usd !== undefined ? `$${p.usd}` : "—"}</td>
                  <td className="px-4 py-3">{p.dkk !== undefined ? `${p.dkk} kr` : "—"}</td>
                  <td className="px-4 py-3">{row.active}/{row.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)}>
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold">Add</h3>

          <label className="grid gap-1">
            <span className="text-sm text-gray-500">Name</span>
            <select value={newSymbol} onChange={e=>setNewSymbol(e.target.value)} className="rounded-xl border px-3 py-2">
              {SYMBOLS.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-500">الشبكة</span>
            <select value={newNetwork} onChange={e=>setNewNetwork(e.target.value)} className="rounded-xl border px-3 py-2">
              {getNetworks(newSymbol).map(n => (<option key={n} value={n}>{n}</option>))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-gray-500">Wallet address</span>
            <input value={newAddress} onChange={e=>setNewAddress(e.target.value)} className="rounded-xl border px-3 py-2" placeholder="Your wallet address" />
          </label>

          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setAddOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl border bg-black text-white" onClick={addCurrency}>Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={()=>setEditOpen(false)}>
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold">Edit</h3>
          <div className="text-sm">Coin: <span className="font-semibold">{selected?.toUpperCase()}</span></div>
          <div className="grid gap-2">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setActive(true)}>Edit all</button>
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setActive(false)}>Stop all</button>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setEditOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>

      <Modal open={delOpen} onClose={()=>setDelOpen(false)}>
        <div className="grid gap-4">
          <h3 className="text-lg font-semibold text-red-600">Delete</h3>
          <p className="text-sm">This will remove all wallets: <span className="font-semibold">{selected?.toUpperCase()}</span></p>
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded-xl border" onClick={()=>setDelOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-xl border bg-red-600 text-white" onClick={deleteSymbol}>Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
