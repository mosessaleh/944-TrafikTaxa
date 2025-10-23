"use client";
import { useEffect, useMemo, useState } from "react";

type Wallet = { id: string; symbol: string; network: string; address: string; isActive: boolean };

const symbols = [
  { id: "usdt", label: "USDT" },
  { id: "usdc", label: "USDC" },
  { id: "btc",  label: "BTC"  },
  { id: "pi",   label: "PI"   },
];

export default function PayWithCrypto(){
  const [amountDkk, setAmountDkk] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("usdt");
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [quote, setQuote] = useState<{amountDkk:number; amountCoin:number; priceDkk:number; last_updated:string} | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(()=>{
    (async()=>{
      const r = await fetch(`/api/payments/wallets?symbol=${symbol}`);
      const j = await r.json();
      setWallets(j.wallets || []);
      setSelectedWallet(null);
    })();
  }, [symbol]);

  useEffect(()=>{
    const amt = Number(amountDkk || "0");
    if (amt>0) {
      (async()=>{
        const r = await fetch(`/api/payments/quote?symbol=${symbol}&amount_dkk=${amt}`, { cache: "no-store" });
        const j = await r.json();
        if (r.ok) setQuote(j);
        else setQuote(null);
      })();
    } else {
      setQuote(null);
    }
  }, [symbol, amountDkk]);

  async function onConfirm(){
    if (!selectedWallet || !quote) return;
    setSubmitting(true);
    try{
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          symbol,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          address: selectedWallet.address,
          amountDkk: quote.amountDkk,
          amountCoin: quote.amountCoin
        })
      });
      if (!res.ok){
        alert(await res.text()); return;
      }
      alert("تم استلام إشعار الدفع. سيتم المعالجة خلال ~15 دقيقة.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Pay with Crypto</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="grid gap-1">
          <span className="text-sm text-gray-500">Ride price (DKK)</span>
          <input value={amountDkk} onChange={e=>setAmountDkk(e.target.value)} type="number" className="rounded-xl border px-3 py-2" placeholder="e.g. 250" />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-500">Currency</span>
          <select value={symbol} onChange={e=>setSymbol(e.target.value)} className="rounded-xl border px-3 py-2">
            {symbols.map(s=>(<option key={s.id} value={s.id}>{s.label}</option>))}
          </select>
        </label>
      </div>

      {quote && (
        <div className="rounded-2xl border p-4 grid md:grid-cols-3 gap-4">
          <div><div className="text-sm text-gray-500">Amount (DKK)</div><div className="text-xl font-semibold">{quote.amountDkk} kr</div></div>
          <div><div className="text-sm text-gray-500">Price</div><div className="text-xl font-semibold">{quote.amountCoin.toFixed(8)} {symbol.toUpperCase()}</div></div>
          <div><div className="text-sm text-gray-500">Last Updated</div><div className="text-sm">{new Date(quote.last_updated).toLocaleString()}</div></div>
        </div>
      )}

      <div className="grid gap-2">
        <div className="text-sm text-gray-500">Choose network & copy the wallet address:</div>
        <div className="grid md:grid-cols-2 gap-3">
          {wallets.map(w => (
            <button key={w.id} onClick={()=>setSelectedWallet(w)}
              className={`rounded-2xl border p-4 text-left ${selectedWallet?.id===w.id?"ring-2 ring-blue-500":""}`}>
              <div className="text-sm text-gray-500">{w.network}</div>
              <div className="font-mono break-all">{w.address}</div>
            </button>
          ))}
          {!wallets.length && <div className="text-sm text-gray-500">No wallets configured yet for {symbol.toUpperCase()}.</div>}
        </div>
      </div>

      <div className="flex gap-3">
        <button disabled={!selectedWallet || !quote || submitting} onClick={onConfirm}
          className="px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40">
          تم تحويل العملات الرقمية
        </button>
      </div>

      <div className="text-sm text-gray-500">
        بعد التحويل، اضغط الزر بالأعلى. سنرسل لك بريدًا بأن طلبك قيد المعالجة (حوالي 15 دقيقة)، وسنخطر الأدمن أيضًا.
      </div>
    </div>
  );
}
