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
  const [quotes, setQuotes] = useState<Record<string, {amountDkk:number; amountCoin:number; priceDkk:number; last_updated:string}>>({});
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [availableSymbols, setAvailableSymbols] = useState<{id: string; label: string}[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);

  useEffect(()=>{
    (async()=>{
      // Get booking ID from URL
      const sp = new URLSearchParams(window.location.search);
      const bookingId = sp.get("booking_id");

      // Fetch booking data to get the actual price and verify ownership
      let bookingPrice = f.amountDkk;
      if (bookingId) {
        try {
          const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
            credentials: 'include'
          });
          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            if (bookingData.ride?.price) {
              bookingPrice = bookingData.ride.price;
              setF(prev => ({ ...prev, amountDkk: bookingPrice }));
            }
          } else if (bookingResponse.status === 401) {
            // alert('Please log in to continue.');
            // window.location.href = '/login';
            console.log(bookingResponse.statusText);
            return;
          } else if (bookingResponse.status === 404) {
            alert('Booking not found.');
            window.location.href = '/';
            return;
          } else {
            alert('You do not have permission to access this booking.');
            window.location.href = '/';
            return;
          }
        } catch (error) {
          console.error('Error fetching booking data:', error);
          alert('Error loading booking data. Please try again.');
          window.location.href = '/';
          return;
        }
      }

      // Fetch available symbols from database FIRST
      try {
        // console.log('🔄 Fetching available crypto symbols...');
        const symbolsResponse = await fetch('/api/crypto/available', {
          credentials: 'include'
        });
        const symbolsData = await symbolsResponse.json();
        const symbols = symbolsData.symbols || [];
        // console.log(`📋 Found ${symbols.length} available symbols:`, symbols.map((s: any) => s.id).join(', '));
        setAvailableSymbols(symbols);

        // Fetch quotes for all available symbols using Promise.allSettled for better performance
        if (bookingPrice > 0 && symbols.length > 0) {
          // console.log(`🔄 Starting to fetch quotes for ${symbols.length} symbols...`);

          const quotePromises = symbols.map(async (symbol: any, index: number) => {
            try {
              // Add small delay between requests to avoid rate limiting
              if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, 150));
              }

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

              const response = await fetch(`/api/payments/quote?symbol=${symbol.id}&amount_dkk=${bookingPrice}`, {
                cache: "no-store",
                credentials: 'include',
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (response.ok) {
                const data = await response.json();
                // console.log(`✅ ${symbol.id}: ${data.amountCoin?.toFixed(6)} ${symbol.id.toUpperCase()}`);
                return { symbol: symbol.id, data, success: true };
              } else {
                const errorText = await response.text();
                // console.warn(`⚠️ ${symbol.id}: ${response.status} - ${errorText}`);
                return { symbol: symbol.id, error: errorText, success: false };
              }
            } catch (error: any) {
              if (error.name === 'AbortError') {
                // console.warn(`⏰ ${symbol.id}: Request timeout`);
              } else {
                // console.error(`💥 ${symbol.id}: ${error.message}`);
              }
              return { symbol: symbol.id, error: error.message, success: false };
            }
          });

          const results = await Promise.allSettled(quotePromises);
          const newQuotes: Record<string, any> = {};

          results.forEach((result, index) => {
            const symbol = symbols[index];
            if (result.status === 'fulfilled' && result.value.success) {
              newQuotes[symbol.id] = result.value.data;
            } else {
              // Set a fallback quote with error indication
              newQuotes[symbol.id] = {
                symbol: symbol.id,
                amountDkk: bookingPrice,
                priceDkk: 0,
                amountCoin: 0,
                last_updated: new Date().toISOString(),
                error: true,
                message: result.status === 'fulfilled' ? result.value.error : 'Request failed'
              };
            }
          });

          const successfulQuotes = Object.keys(newQuotes).filter(k => !newQuotes[k].error).length;
          // console.log(`📊 Loaded ${successfulQuotes}/${symbols.length} quotes successfully`);
          setQuotes(newQuotes);
        } else {
          // console.log('⚠️ No booking price or symbols available');
        }
      } catch (error) {
        console.error('Failed to load crypto data:', error);
      } finally {
        setLoadingQuotes(false);
      }

    })();
  }, []);

  // Remove the old quote fetching useEffect since we now fetch all quotes at once

  // Update wallets when symbol changes
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/payments/wallets?symbol=${f.symbol}`, {
          credentials: 'include'
        });
        const j = await r.json();
        setWallets(j.wallets || []);
        setSelectedWallet(null); // Reset selection when symbol changes
      } catch (error) {
        console.error('Failed to load wallets:', error);
        setWallets([]);
      }
    })();
  }, [f.symbol]);

  useEffect(()=>{
    // Prefill amount from URL if present
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get("amount_dkk");
    if (a) setF({...f, amountDkk: Number(a)});
  }, []);

  async function onConfirm(){
    const currentQuote = quotes[f.symbol];
    if (!selectedWallet || !currentQuote) return;
    setValidationErrors({});

    // Validate form
    const validation = CryptoPaymentSchema.safeParse({
      ...f,
      walletId: selectedWallet.id,
      network: selectedWallet.network,
      address: selectedWallet.address,
      amountCoin: currentQuote.amountCoin
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
      // Get booking ID from URL
      const sp = new URLSearchParams(window.location.search);
      const bookingId = sp.get("booking_id");

      // Create the crypto payment record (this will also update booking status and payment method)
      const res = await fetch(`/api/payments/crypto/confirm?booking_id=${bookingId}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: 'include',
        body: JSON.stringify({
          symbol: f.symbol,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          address: selectedWallet.address,
          amountDkk: currentQuote.amountDkk,
          amountCoin: currentQuote.amountCoin,
          bookingId: bookingId
        })
      });
      if (!res.ok){
        const errorText = await res.text();
        console.error('Crypto payment confirm failed:', errorText);
        toast.error(errorText || 'Payment confirmation failed'); return;
      }

      toast.success("Payment notification received. Processing will take ~15 minutes.");

      // Redirect to bookings page after successful payment
      setTimeout(() => {
        window.location.href = '/bookings';
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ErrorBoundary>
      <div className="max-w-3xl mx-auto p-6 grid gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pay with Crypto</h1>
          <a href="/pay" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            ← Back to Payment Methods
          </a>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
           <div className="grid gap-1">
             <span className="text-sm text-gray-500">Ride price (DKK)</span>
             <div className="rounded-xl border px-3 py-2 bg-gray-50 text-gray-900 font-medium">
               {loadingQuotes ? 'Loading...' : `${f.amountDkk} DKK`}
             </div>
           </div>
          <label className="grid gap-1">
            <span className="text-sm text-gray-500">Currency</span>
            <select value={f.symbol} onChange={e=>{setF({...f, symbol: e.target.value as any});}} className="rounded-xl border px-3 py-2">
              {availableSymbols.map(s=>(
                <option key={s.id} value={s.id}>
                  {s.id === 'btc' && '₿'}
                  {s.id === 'eth' && 'Ξ'}
                  {s.id === 'bnb' && 'BNB'}
                  {s.id === 'xrp' && '✕'}
                  {s.id === 'pi' && 'π'}
                  {s.id === 'usdt' && '₮'}
                  {s.id === 'usdc' && '₵'}
                  {' ' + s.label}
                </option>
              ))}
            </select>
            {validationErrors.symbol && <span className="text-red-500 text-sm">{validationErrors.symbol}</span>}
          </label>
        </div>

        {loadingQuotes ? (
          <div className="rounded-2xl border p-4 space-y-4">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading cryptocurrency prices...</p>
            </div>
          </div>
        ) : quotes[f.symbol] && !(quotes[f.symbol] as any).error && (
          <div className="rounded-2xl border p-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div><div className="text-sm text-gray-500">Ride Cost</div><div className="text-xl font-semibold">{f.amountDkk} DKK</div></div>
              <div><div className="text-sm text-gray-500">Processing Fee</div><div className="text-xl font-semibold text-amber-600">+ 25 DKK</div></div>
              <div><div className="text-sm text-gray-500">Total Amount</div><div className="text-xl font-semibold text-green-600">{f.amountDkk + 25} DKK</div></div>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm text-gray-500">Cryptocurrency Amount</div>
              <div className="text-2xl font-bold text-blue-600">{quotes[f.symbol].amountCoin.toFixed(8)} {f.symbol.toUpperCase()}</div>
              <div className="text-xs text-gray-400 mt-1">Exchange rate: 1 {f.symbol.toUpperCase()} = {quotes[f.symbol].priceDkk.toFixed(2)} DKK | Last updated: {new Date(quotes[f.symbol].last_updated).toLocaleString()}</div>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <div className="text-sm text-gray-500">Choose network & copy the wallet address:</div>
          <div className="grid md:grid-cols-2 gap-3">
            {wallets.map(w => (
              <button key={w.id} onClick={()=>setSelectedWallet(w)}
                className={`rounded-2xl border p-4 text-left transition-all ${selectedWallet?.id===w.id?"ring-2 ring-blue-500 bg-blue-50":"hover:bg-gray-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-500">{w.network}</div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(w.address);
                      toast.success('Address copied to clipboard!');
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                    title="Copy address"
                  >
                    📋 Copy
                  </div>
                </div>
                <div className="font-mono text-sm break-all bg-gray-50 p-2 rounded">{w.address}</div>
              </button>
            ))}
            {!wallets.length && <div className="text-sm text-gray-500">No wallets configured yet for {f.symbol.toUpperCase()}.</div>}
          </div>
        </div>

        <div className="text-sm text-gray-500">
          <div className="mb-2 font-medium text-amber-600">⚠️ Important: A 25 DKK processing fee has been added to your total amount.</div>
          After transferring the cryptocurrency, click the button below. We will send you an email that your request is being processed (about 15 minutes), and we will also notify the admin.
        </div>

        <div className="flex gap-3">
          <button disabled={!selectedWallet || !quotes[f.symbol] || submitting} onClick={onConfirm}
            className="px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40">
            I have transferred the cryptocurrency
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
