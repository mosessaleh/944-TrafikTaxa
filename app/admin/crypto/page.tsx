"use client";
import useSWR, { mutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import { SYMBOLS, getCoinGeckoId, getNetworks, getCoinLogoUrl } from "@/lib/crypto";
import toast from "react-hot-toast";
import ErrorBoundary from "@/components/error-boundary";
import { 
  Bitcoin, 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Wallet,
  Globe,
  Hash,
  DollarSign,
  Activity
} from 'lucide-react';

type WalletRow = { id: string; symbol: string; network: string; address: string; isActive: boolean; createdAt: string };
type WalletsResp = { wallets: WalletRow[] };
type PricesResp = { source: string; last_updated: string; vs: string[]; data: Record<string, { usd?: number; dkk?: number }> };

async function fetcher(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function Modal({ open, onClose, children }:{ open:boolean; onClose:()=>void; children: React.ReactNode }){
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function AdminCryptoPage(){
  const { data: walletsData, error: walletsErr, isLoading: walletsLoading } = useSWR<WalletsResp>("/api/admin/crypto/symbols", fetcher, { refreshInterval: 30_000 });
  const [selected, setSelected] = useState<string | null>(null);

  const ids = useMemo(()=>{
    const list = (walletsData?.wallets || []).map(w => getCoinGeckoId(w.symbol)).filter(Boolean) as string[];
    const unique = Array.from(new Set(list));
    return unique.join(",");
  }, [walletsData]);

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

  const rows = (walletsData?.wallets || []).sort((a,b)=>a.symbol.localeCompare(b.symbol));

  const priceOf = (symbol: string) => {
    const id = getCoinGeckoId(symbol);
    if (!id) return { usd: undefined, dkk: undefined };
    const row = (prices?.data as any)?.[id] || {};
    return { usd: row.usd, dkk: row.dkk };
  };

  async function addCurrency(){
    console.log('Adding currency:', { symbol: newSymbol, network: newNetwork, address: newAddress });
    const res = await fetch("/api/admin/crypto/wallets", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ symbol: newSymbol, network: newNetwork, address: newAddress })
    });
    const responseText = await res.text();
    if (!res.ok){
      toast.error(responseText);
      return;
    }
    setAddOpen(false); setNewAddress("");
    mutate("/api/admin/crypto/symbols");
  }

  async function setActive(active:boolean){
    if (!selected) return;
    const res = await fetch(`/api/admin/crypto/wallets/${encodeURIComponent(selected)}`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ active })
    });
    if (!res.ok){ toast.error(await res.text()); return; }
    setEditOpen(false);
    mutate("/api/admin/crypto/symbols");
  }

  async function deleteWallet(){
    if (!selected) return;
    const res = await fetch(`/api/admin/crypto/wallets/${encodeURIComponent(selected)}`, { method: "DELETE" });
    if (!res.ok){ toast.error(await res.text()); return; }
    setDelOpen(false); setSelected(null);
    mutate("/api/admin/crypto/symbols");
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Crypto Wallets</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <Activity size={14} />
                <span>Source: {prices?.source || "—"}</span>
                <span>•</span>
                <span>Last updated: {prices?.last_updated ? new Date(prices.last_updated).toLocaleTimeString() : "—"}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm" 
                onClick={()=>setAddOpen(true)}
            >
                <Plus size={16} />
                Add Wallet
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Coin</th>
                  <th className="px-6 py-3">Network</th>
                  <th className="px-6 py-3">Address</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Price (USD)</th>
                  <th className="px-6 py-3">Price (DKK)</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {walletsLoading && (
                  <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={7}>Loading wallets...</td></tr>
                )}
                {walletsErr && (
                  <tr><td className="px-6 py-8 text-center text-red-600" colSpan={7}>Failed to load wallets.</td></tr>
                )}
                {!walletsLoading && !walletsErr && rows.map(row => {
                  const p = priceOf(row.symbol);
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                            <img src={getCoinLogoUrl(row.symbol)} alt={row.symbol} className="w-8 h-8 rounded-full bg-gray-100" />
                            <span className="uppercase">{row.symbol}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            {row.network}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600 max-w-xs truncate" title={row.address}>
                        {row.address}
                      </td>
                      <td className="px-6 py-4">
                        {row.isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle size={12} /> Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-gray-500 text-xs font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                <XCircle size={12} /> Inactive
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {p.usd !== undefined ? `$${p.usd.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {p.dkk !== undefined ? `${p.dkk.toLocaleString()} kr` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={()=>{setSelected(row.id); setEditOpen(true);}}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button 
                                onClick={()=>{setSelected(row.id); setDelOpen(true);}}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!walletsLoading && !walletsErr && rows.length === 0 && (
                    <tr><td className="px-6 py-12 text-center text-gray-500" colSpan={7}>No wallets configured.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal open={addOpen} onClose={()=>setAddOpen(false)}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Add Wallet</h3>
            <button onClick={()=>setAddOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Coin</span>
              <div className="relative">
                <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select value={newSymbol} onChange={e=>setNewSymbol(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
                    {SYMBOLS.map(s => (<option key={s.id} value={s.id}>{s.label}</option>))}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Network</span>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select value={newNetwork} onChange={e=>setNewNetwork(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
                    {getNetworks(newSymbol).map(n => (<option key={n} value={n}>{n}</option>))}
                </select>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Wallet Address</span>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={newAddress} onChange={e=>setNewAddress(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="Enter wallet address" />
              </div>
            </label>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" onClick={()=>setAddOpen(false)}>Cancel</button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700" onClick={addCurrency}>Save Wallet</button>
          </div>
        </Modal>

        <Modal open={editOpen} onClose={()=>setEditOpen(false)}>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Edit Wallet</h3>
            <button onClick={()=>setEditOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            {selected && (() => {
              const wallet = rows.find(r => r.id === selected);
              return wallet ? (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Coin:</span> <span className="font-medium uppercase">{wallet.symbol}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Network:</span> <span className="font-medium">{wallet.network}</span></div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-gray-500">Address:</span>
                    <span className="font-mono text-xs bg-white border border-gray-200 rounded p-2 break-all">{wallet.address}</span>
                  </div>
                  <div className="flex justify-between pt-1"><span className="text-gray-500">Status:</span> 
                    <span className={`font-medium ${wallet.isActive ? 'text-green-600' : 'text-gray-600'}`}>{wallet.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>
              ) : null;
            })()}
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                className="px-4 py-2.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-medium text-sm transition-colors flex items-center justify-center gap-2" 
                onClick={()=>setActive(true)}
              >
                <CheckCircle size={16} /> Activate
              </button>
              <button 
                className="px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium text-sm transition-colors flex items-center justify-center gap-2" 
                onClick={()=>setActive(false)}
              >
                <XCircle size={16} /> Deactivate
              </button>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" onClick={()=>setEditOpen(false)}>Close</button>
          </div>
        </Modal>

        <Modal open={delOpen} onClose={()=>setDelOpen(false)}>
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Wallet</h3>
            <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete this wallet? This action cannot be undone.
            </p>
            
            {selected && (() => {
              const wallet = rows.find(r => r.id === selected);
              return wallet ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm text-left border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium uppercase">{wallet.symbol}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">{wallet.network}</span>
                  </div>
                  <div className="font-mono text-xs text-gray-500 truncate">{wallet.address}</div>
                </div>
              ) : null;
            })()}

            <div className="flex gap-3 justify-center">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" onClick={()=>setDelOpen(false)}>Cancel</button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700" onClick={deleteWallet}>Delete Wallet</button>
            </div>
          </div>
        </Modal>
      </div>
    </ErrorBoundary>
  );
}
