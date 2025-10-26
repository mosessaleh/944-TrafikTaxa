"use client";
import { useEffect, useState } from "react";
import { SYMBOLS, getNetworks } from "@/lib/crypto";
import toast from "react-hot-toast";
import ErrorBoundary from "@/components/error-boundary";
import { CryptoPaymentSchema, CryptoPaymentInput } from '@/lib/validation';

type Wallet = { id: string; symbol: string; network: string; address: string; isActive: boolean };

export default function PayWithCrypto(){
  const [f, setF] = useState<CryptoPaymentInput>({amountDkk: 0, symbol: "usdt", walletId: "", network: "", address: "", amountCoin: 0});
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [quote, setQuote] = useState<{amountDkk:number; amountCoin:number; priceDkk:number; last_updated:string} | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(()=>{
    (async()=>{
      const r = await fetch(`/api/payments/wallets?symbol=${f.symbol}`);
      const j = await r.json();
      setWallets(j.wallets || []);
      setSelectedWallet(null);
    })();
  }, [f.symbol]);

  useEffect(()=>{
    const amt = f.amountDkk;
    if (amt>0) {
      (async()=>{
        const r = await fetch(`/api/payments/quote?symbol=${f.symbol}&amount_dkk=${amt}`, { cache: "no-store" });
        const j = await r.json();
        if (r.ok) setQuote(j);
        else setQuote(null);
      })();
    } else {
      setQuote(null);
    }
  }, [f.symbol, f.amountDkk]);

  useEffect(()=>{
    // Prefill amount from URL if present
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get("amount_dkk");
    if (a) setF({...f, amountDkk: Number(a)});
  }, []);

  async function onConfirm(){
    if (!selectedWallet || !quote) return;
    setValidationErrors({});

    // Validate form
    const validation = CryptoPaymentSchema.safeParse({
      ...f,
      walletId: selectedWallet.id,
      network: selectedWallet.network,
      address: selectedWallet.address,
      amountCoin: quote.amountCoin
    });
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    try{
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          symbol: f.symbol,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          address: selectedWallet.address,
          amountDkk: quote.amountDkk,
          amountCoin: quote.amountCoin
        })
      });
      if (!res.ok){
        toast.error(await res.text()); return;
      }
      toast.success("تم استلام إشعار الدفع. سيتم المعالجة خلال ~15 دقيقة.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ErrorBoundary>
      <div className="max-w-3xl mx-auto p-6 grid gap-6">
        <h1 className="text-2xl font-bold">Pay with Crypto</h1>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-gray-500">Ride price (DKK)</span>
            <input value={f.amountDkk} onChange={e=>setF({...f, amountDkk: Number(e.target.value) || 0})} type="number" className="rounded-xl border px-3 py-2" placeholder="e.g. 250" />
            {validationErrors.amountDkk && <span className="text-red-500 text-sm">{validationErrors.amountDkk}</span>}
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-gray-500">Currency</span>
            <select value={f.symbol} onChange={e=>setF({...f, symbol: e.target.value as any})} className="rounded-xl border px-3 py-2">
              {SYMBOLS.map(s=>(<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
            {validationErrors.symbol && <span className="text-red-500 text-sm">{validationErrors.symbol}</span>}
          </label>
        </div>

        {quote && (
          <div className="rounded-2xl border p-4 grid md:grid-cols-3 gap-4">
            <div><div className="text-sm text-gray-500">Amount (DKK)</div><div className="text-xl font-semibold">{quote.amountDkk} kr</div></div>
            <div><div className="text-sm text-gray-500">Price</div><div className="text-xl font-semibold">{quote.amountCoin.toFixed(8)} {f.symbol.toUpperCase()}</div></div>
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
            {!wallets.length && <div className="text-sm text-gray-500">No wallets configured yet for {f.symbol.toUpperCase()}.</div>}
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
    </ErrorBoundary>
  );
}
