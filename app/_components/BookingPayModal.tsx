"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SYMBOLS, getCoinGeckoId } from "@/lib/crypto";
import toast from "react-hot-toast";

type Wallet = { id: string; symbol: string; network: string; address: string; isActive: boolean };
type PricesResp = { source: string; last_updated: string; vs: string[]; data: Record<string, { dkk?: number }> };
type SymbolsResp = { symbols: { symbol: string; total: number; active: number }[] };

const CRYPTO_FEE_DKK = 25; // Extra fee when paying with cryptocurrencies

function getCapturedAmount(): number | null {
  const w: any = window as any;
  const a = w.__bookingAmountDKK;
  if (typeof a === "number" && a > 0) return a;
  return null;
}

export default function BookingPayModal({
  open, onClose, onPaid
}:{ open:boolean; onClose:()=>void; onPaid:()=>Promise<void>|void }){
  const modalRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"method"|"card"|"crypto">("method");
  const [loading, setLoading] = useState(false);

  // Ride amount (read-only, captured at click)
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(()=>{
    if (open) setAmount(getCapturedAmount());
  }, [open]);

  // Focus management and screen reader announcements
  useEffect(() => {
    if (open) {
      const previousFocus = document.activeElement as HTMLElement;
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements?.[0] as HTMLElement;
      const lastFocusable = focusableElements?.[focusableElements.length - 1] as HTMLElement;

      // Announce modal opening to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = 'Payment window opened. Press Escape to close.';
      document.body.appendChild(announcement);

      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              lastFocusable?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              firstFocusable?.focus();
              e.preventDefault();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      firstFocusable?.focus();

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        previousFocus?.focus();
      };
    }
  }, [open, onClose]);

  const amountNum = amount || 0;
  const amountCryptoDkk = amountNum > 0 ? amountNum + CRYPTO_FEE_DKK : 0;

  // PUBLIC symbols list (no admin auth)
  const [symbols, setSymbols] = useState<SymbolsResp|null>(null);
  const [symErr, setSymErr] = useState<string | null>(null);
  useEffect(()=>{
    if (!open) return;
    (async()=>{
      try{
        setSymErr(null);
        const r = await fetch("/api/crypto/available", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        setSymbols(await r.json());
      }catch(e:any){
        setSymErr(e?.message || "Failed to load crypto options");
      }
    })();
  }, [open]);

  // Build CoinGecko ids list to fetch prices in DKK
  const ids = useMemo(()=>{
    if (!symbols?.symbols?.length) return "";
    const ids = symbols.symbols.map(s => getCoinGeckoId(s.symbol)).filter(Boolean) as string[];
    return Array.from(new Set(ids)).join(",");
  }, [symbols]);

  const [prices, setPrices] = useState<PricesResp|null>(null);
  const [priceErr, setPriceErr] = useState<string | null>(null);
  useEffect(()=>{
    if (!ids) { setPrices(null); return; }
    (async()=>{
      try{
        setPriceErr(null);
        const r = await fetch(`/api/crypto/tickers?ids=${encodeURIComponent(ids)}&vs=dkk`, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        setPrices(await r.json());
      }catch(e:any){
        setPriceErr(e?.message || "Failed to load prices");
      }
    })();
  }, [ids]);

  const [selectedSymbol, setSelectedSymbol] = useState<string|null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);

  useEffect(()=>{
    if (!selectedSymbol) { setWallets([]); setSelectedWallet(null); return; }
    (async()=>{
      const r = await fetch(`/api/payments/wallets?symbol=${selectedSymbol}`);
      const j = await r.json();
      setWallets(j.wallets || []);
      setSelectedWallet(null);
    })();
  }, [selectedSymbol]);

  async function payByCard(){
    if (!amountNum || amountNum<=0) { toast.error("Could not determine the trip amount"); return; }
    setLoading(true);
    try{
      // Redirect to Stripe payment page instead of using mock
      window.location.href = `/pay/card?amount_dkk=${encodeURIComponent(amountNum.toString())}`;
    } catch (err: any) {
      toast.error("Failed to redirect to payment page");
      setLoading(false);
    }
  }

  async function confirmCrypto(){
    if (!amountCryptoDkk || amountCryptoDkk<=0 || !selectedWallet || !selectedSymbol) {
      const errorMsg = "Select a currency and wallet; the amount could not be determined";
      toast.error(errorMsg);
      // Announce error to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Error: ${errorMsg}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 3000);
      return;
    }
    const id = getCoinGeckoId(selectedSymbol)!;
    const dkk = (prices?.data as any)?.[id]?.dkk;
    if (!dkk || dkk<=0) {
      const errorMsg = "Failed to fetch currency price";
      toast.error(errorMsg);
      // Announce error to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'assertive');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Error: ${errorMsg}`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 3000);
      return;
    }
    const amountCoin = amountCryptoDkk / dkk; // includes the 25 DKK fee
    setLoading(true);
    try{
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          symbol: selectedSymbol,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          address: selectedWallet.address,
          amountDkk: amountCryptoDkk, // store amount in DKK including the fee
          amountCoin: amountCoin
        })
      });
      if (!res.ok) {
        const errorMsg = await res.text();
        toast.error(errorMsg);
        // Announce error to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `Payment error: ${errorMsg}`;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 3000);
        return;
      }
      await onPaid();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 modal-overlay animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-2xl border bg-white p-6 modal-box animate-fade-in"
        onClick={e=>e.stopPropagation()}
      >
        {step === "method" && (
          <div className="grid gap-4">
            <h2 id="modal-title" className="text-lg font-semibold">Choose payment method</h2>
            <div id="modal-description" className="sr-only">
              Choose how you want to pay for your trip. You can pay by card or with cryptocurrencies.
            </div>
 
            <div className="text-sm text-gray-500">
              Trip amount (DKK): <span className="font-semibold">{amountNum || "—"}</span>
            </div>
            {!!amountNum && (
              <div className="text-xs text-gray-500">
                <span className="font-semibold">Note:</span> If you choose <span className="font-semibold">cryptocurrencies</span>, an extra <span className="font-semibold">{CRYPTO_FEE_DKK} kr</span> service fee is added.
                Total for crypto payment: <span className="font-semibold">{amountCryptoDkk} kr</span>.
              </div>
            )}
            {!amountNum && (
              <div
                className="text-sm text-red-600"
                role="alert"
                aria-live="assertive"
              >
                Could not automatically determine the trip amount from the page.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-3 animate-fade-in" role="group" aria-labelledby="payment-methods-label">
              <div id="payment-methods-label" className="sr-only">Payment method options</div>
              <button
                onClick={()=>setStep("card")}
                className="rounded-2xl border p-4 text-left hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ease-in-out"
                disabled={!amountNum}
                aria-describedby="card-description"
              >
                <div className="text-base font-semibold">Credit/Debit Card</div>
                <div id="card-description" className="text-sm text-gray-500">Instant processing — Total: {amountNum || "—"} kr</div>
              </button>
              <button
                onClick={()=>setStep("crypto")}
                className="rounded-2xl border p-4 text-left hover:shadow-lg hover:scale-[1.02] transition-all duration-200 ease-in-out"
                disabled={!amountNum}
                aria-describedby="crypto-description"
              >
                <div className="text-base font-semibold">Cryptocurrency</div>
                <div id="crypto-description" className="text-sm text-gray-500">Takes ~15 minutes — Fee +{CRYPTO_FEE_DKK} kr — Total: {amountCryptoDkk || "—"} kr</div>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                className="px-3 py-2 rounded-xl border"
                onClick={onClose}
                aria-label="Close payment window"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === "card" && (
          <div className="grid gap-4">
            <h2 id="modal-title" className="text-lg font-semibold">Pay by card</h2>
            <div id="modal-description" className="sr-only">
              Complete your payment using a credit or debit card.
            </div>
            <div className="text-sm text-gray-500">Amount to pay: {amountNum || "—"} DKK</div>
            <div className="p-4 rounded-xl border bg-gray-50 animate-fade-in">
              <div className="text-sm text-gray-500">Demo only — this will be replaced with a real payment gateway later.</div>
              <button
                disabled={loading || !amountNum}
                onClick={payByCard}
                className="mt-3 px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40 hover:bg-gray-900 transition-colors duration-200"
                aria-describedby="pay-button-description"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Processing...
                  </>
                ) : (
                  "Pay now"
                )}
              </button>
              <div id="pay-button-description" className="sr-only">
                Press to complete the card payment. Amount: {amountNum || "—"} DKK.
              </div>
            </div>
            <div className="flex justify-between">
              <button
                className="px-3 py-2 rounded-xl border"
                onClick={()=>setStep("method")}
                aria-label="Back to payment method selection"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === "crypto" && (
          <div className="grid gap-4">
            <h2 id="modal-title" className="text-lg font-semibold">Pay with cryptocurrency</h2>
            <div id="modal-description" className="sr-only">
              Choose a cryptocurrency and copy the address to complete the payment.
            </div>
            <div className="text-sm text-gray-500">
              Amount due: {amountNum || "—"} DKK + fee {CRYPTO_FEE_DKK} kr = <span className="font-semibold">{amountCryptoDkk || "—"} DKK</span>
            </div>

            {symErr && (
              <div
                className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {symErr}
              </div>
            )}
            {!symbols && !symErr && <div className="text-sm text-gray-500">Loading cryptocurrency options…</div>}
 
            <div className="overflow-x-auto rounded-2xl border animate-fade-in" role="table" aria-label="Available cryptocurrencies">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left" scope="col">Currency</th>
                    <th className="px-3 py-2 text-left" scope="col">Required amount (approx.)</th>
                  </tr>
                </thead>
                <tbody>
                  {(symbols?.symbols || []).map(row => {
                    const id = getCoinGeckoId(row.symbol);
                    const dkk = id ? (prices?.data as any)?.[id]?.dkk : undefined;
                    const need = amountCryptoDkk && dkk ? (amountCryptoDkk / dkk) : undefined; // includes the fee
                    const selected = selectedSymbol === row.symbol;
                    return (
                      <tr
                        key={row.symbol}
                        className={`border-t transition-colors duration-150 hover:bg-gray-50 ${selected?"bg-blue-50":""}`}
                        onClick={()=>setSelectedSymbol(row.symbol)}
                        role="button"
                        tabIndex={0}
                        aria-selected={selected}
                        aria-label={`Select ${row.symbol.toUpperCase()} - required amount: ${need ? need.toFixed(8) : "Not available"}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSymbol(row.symbol);
                          }
                        }}
                      >
                        <td className="px-3 py-2 font-semibold">{row.symbol.toUpperCase()}</td>
                        <td className="px-3 py-2 text-gray-500">{need ? need.toFixed(8) : "—"}</td>
                      </tr>
                    );
                  })}
                  {symbols?.symbols?.length === 0 && <tr><td className="px-3 py-2" colSpan={2}>No currencies have been set up yet.</td></tr>}
                </tbody>
              </table>
            </div>

            {!!selectedSymbol && (
              <div className="grid gap-2">
                <div className="text-sm text-gray-500">Choose network/wallet — copy the address and send manually:</div>
                <div className="grid md:grid-cols-2 gap-2 animate-fade-in" role="radiogroup" aria-labelledby="wallet-selection-label">
                  <div id="wallet-selection-label" className="sr-only">Choose a wallet to pay with</div>
                  {wallets.map(w => (
                    <button
                      key={w.id}
                      onClick={()=>setSelectedWallet(w)}
                      className={`rounded-2xl border p-3 text-left transition-all duration-200 ease-in-out hover:shadow-md hover:scale-[1.02] ${selectedWallet?.id===w.id?"ring-2 ring-blue-500 bg-blue-50":""}`}
                      role="radio"
                      aria-checked={selectedWallet?.id === w.id}
                      aria-describedby={`wallet-${w.id}-description`}
                    >
                      <div className="text-sm text-gray-500">{w.network}</div>
                      <div className="font-mono break-all" id={`wallet-${w.id}-description`}>{w.address}</div>
                    </button>
                  ))}
                  {!wallets.length && <div className="text-sm text-gray-500 animate-fade-in">No active wallets are configured for this currency.</div>}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                className="px-3 py-2 rounded-xl border"
                onClick={()=>setStep("method")}
                aria-label="Back to payment method selection"
              >
                Back
              </button>
              <button
                disabled={!selectedWallet || !amountCryptoDkk || loading}
                onClick={confirmCrypto}
                className="px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40 hover:bg-gray-900 transition-colors duration-200"
                aria-describedby="confirm-crypto-description"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Confirming...
                  </>
                ) : (
                  "I have completed the crypto transfer"
                )}
              </button>
              <div id="confirm-crypto-description" className="sr-only">
                Press after completing the transfer to confirm the crypto payment.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
