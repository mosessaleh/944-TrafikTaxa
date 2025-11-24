"use client";
import { useEffect, useState } from "react";
import { SYMBOLS, getNetworks, getCoinLogoUrl } from "@/lib/crypto";
import toast from "react-hot-toast";
import ErrorBoundary from "@/components/error-boundary";
import { CryptoPaymentSchema, CryptoPaymentInput } from '@/lib/validation';

const CustomSelect = ({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; logo: string }[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative">
      <div
        className="rounded-xl border px-3 py-2 bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {selectedOption && (
            <>
              <img src={selectedOption.logo} alt={selectedOption.value} className="w-5 h-5 rounded-full" />
              <span>{selectedOption.label}</span>
            </>
          )}
        </div>
        <span className="text-gray-400">▼</span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
          {options.map(option => (
            <div
              key={option.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <img src={option.logo} alt={option.value} className="w-5 h-5 rounded-full" />
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

type Wallet = { id: string; symbol: string; network: string; address: string; isActive: boolean };

export default function PayWithCrypto(){
  const [f, setF] = useState<CryptoPaymentInput>({amountDkk: 0, symbol: "usdt", walletId: "", network: "", address: "", amountCoin: 0});
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [quotes, setQuotes] = useState<Record<string, {amountDkk:number; amountCoin:number; priceDkk:number; last_updated:string}>>({});
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [availableSymbols, setAvailableSymbols] = useState<{id: string; label: string}[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize page data sequentially - only once
  useEffect(() => {
    if (initialized) return; // Prevent multiple calls

    const initializePage = async () => {
      try {
        // Step 1: Get booking data
        const sp = new URLSearchParams(window.location.search);
        const bookingId = sp.get("booking_id");

        let bookingPrice = 0;
        const searchParams = new URLSearchParams(window.location.search);
        const invoiceId = searchParams.get("invoice_id");

        if (invoiceId) {
          // If we have invoice ID, fetch invoice data to calculate total including late fees
          console.log("CryptoPayment: Fetching invoice data for amount calculation");
          const invoiceResponse = await fetch(`/api/invoices/${invoiceId}/data`, {
            credentials: 'include'
          });
          if (invoiceResponse.ok) {
            const invoiceData = await invoiceResponse.json();
            if (invoiceData.invoice && invoiceData.invoice.ride) {
              const baseAmount = invoiceData.invoice.ride.price;
              const lateFee1 = invoiceData.invoice.lateFee1 || 0;
              const lateFee2 = invoiceData.invoice.lateFee2 || 0;
              bookingPrice = baseAmount + lateFee1 + lateFee2;
              console.log("CryptoPayment: Calculated total amount including late fees", {
                baseAmount,
                lateFee1,
                lateFee2,
                totalAmount: bookingPrice
              });
            }
          } else {
            console.error('❌ Invoice fetch failed:', invoiceResponse.status);
            alert('Invoice not found or access denied.');
            window.location.href = '/';
            return;
          }
        } else if (bookingId) {
          // Regular booking without invoice
          const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
            credentials: 'include'
          });
          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            bookingPrice = bookingData.ride?.price || 0;
          } else {
            console.error('❌ Booking fetch failed:', bookingResponse.status);
            alert('Booking not found or access denied.');
            window.location.href = '/';
            return;
          }
        }

        // Step 2: Set booking price first
        setF(prev => ({ ...prev, amountDkk: bookingPrice }));

        // Step 3: Fetch available symbols
        const symbolsResponse = await fetch('/api/crypto/available', {
          credentials: 'include'
        });
        const symbolsData = await symbolsResponse.json();
        const symbols = symbolsData.symbols || [];
        setAvailableSymbols(symbols);

        // Step 4: Fetch current market prices and store them
        if (symbols.length > 0) {
          const pricePromises = symbols.map(async (symbol: any) => {
            try {
              const response = await fetch(`/api/crypto/tickers?ids=${symbol.id === 'pi' ? 'pi-network' : SYMBOLS.find(s => s.id === symbol.id)?.coingeckoId || symbol.id}&vs=dkk`, {
                cache: "no-store"
              });

              if (response.ok) {
                const data = await response.json();
                const price = data.data?.[symbol.id === 'pi' ? 'pi-network' : SYMBOLS.find(s => s.id === symbol.id)?.coingeckoId || symbol.id]?.dkk;
                if (price) {
                  return { symbol: symbol.id, price, success: true };
                } else {
                  return { symbol: symbol.id, price: 0, success: false };
                }
              } else {
                console.error(`${symbol.id.toUpperCase()}: Failed to fetch price`);
                return { symbol: symbol.id, price: 0, success: false };
              }
            } catch (error) {
              console.error(`${symbol.id.toUpperCase()}: Network error`);
              return { symbol: symbol.id, price: 0, success: false };
            }
          });

          const results = await Promise.allSettled(pricePromises);
          const prices: Record<string, number> = {};
          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
              prices[symbols[index].id] = result.value.price;
            }
          });
          setCurrentPrices(prices);
        }

        setInitialized(true);

      } catch (error) {
        console.error('❌ Failed to initialize crypto payment page:', error);
        alert('Error loading payment page. Please try again.');
        window.location.href = '/';
      }
    };

    initializePage();
  }, [initialized]);

  // Remove the old quote fetching useEffect since we now fetch all quotes at once

  // Update wallets when symbol changes - only after initialization
  useEffect(() => {
    if (!initialized || !f.symbol) return;

    const fetchWallets = async () => {
      try {
        const response = await fetch(`/api/payments/wallets?symbol=${f.symbol}`, {
          credentials: 'include'
        });
        const data = await response.json();
        setWallets(data.wallets || []);
        setSelectedWallet(null); // Reset selection

        // Calculate total amount in selected currency
        const totalDkk = f.amountDkk + 25; // Ride cost + 25 DKK fee
        const priceInDkk = currentPrices[f.symbol];
        if (priceInDkk && priceInDkk > 0) {
          const amountInCrypto = totalDkk / priceInDkk;
          setCalculatedAmount(amountInCrypto);
        }
      } catch (error) {
        console.error('Failed to load wallets:', error);
        setWallets([]);
      }
    };

    fetchWallets();
  }, [f.symbol, initialized, f.amountDkk, currentPrices]);

  useEffect(()=>{
    // Prefill amount from URL if present
    const sp = new URLSearchParams(window.location.search);
    const a = sp.get("amount_dkk");
    if (a) setF({...f, amountDkk: Number(a)});
  }, []);

  async function onConfirm(){
    if (!selectedWallet) return;
    setValidationErrors({});

    // Validate form
    const validation = CryptoPaymentSchema.safeParse({
      ...f,
      walletId: selectedWallet.id,
      network: selectedWallet.network,
      address: selectedWallet.address,
      amountCoin: calculatedAmount
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

      // Create the crypto payment record
      const res = await fetch(`/api/payments/crypto/confirm?booking_id=${bookingId}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        credentials: 'include',
        body: JSON.stringify({
          symbol: f.symbol,
          walletId: selectedWallet.id,
          network: selectedWallet.network,
          address: selectedWallet.address,
          amountDkk: f.amountDkk + 25,
          amountCoin: calculatedAmount,
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

        <div className="grid gap-4">
           <label className="grid gap-1">
             <span className="text-sm text-gray-500">Currency</span>
             <CustomSelect
               value={f.symbol}
               onChange={(value) => setF({...f, symbol: value as any})}
               options={availableSymbols.map(s => ({
                 value: s.id,
                 label: `${s.id === 'btc' ? '' : s.id === 'eth' ? '' : s.id === 'bnb' ? '' : s.id === 'xrp' ? '' : s.id === 'pi' ? '' : s.id === 'usdt' ? '' : s.id === 'usdc' ? '' : ''} ${s.label}`,
                 logo: getCoinLogoUrl(s.id) || ''
               }))}
               placeholder="Select currency"
             />
             {validationErrors.symbol && <span className="text-red-500 text-sm">{validationErrors.symbol}</span>}
           </label>
         </div>

        {initialized && calculatedAmount > 0 && (
          <div className="rounded-2xl border p-4 space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div><div className="text-sm text-gray-500">Ride Cost</div><div className="text-xl font-semibold">{f.amountDkk} DKK</div></div>
              <div><div className="text-sm text-gray-500">Processing Fee</div><div className="text-xl font-semibold text-amber-600">+ 25 DKK</div></div>
              <div><div className="text-sm text-gray-500">Total Amount</div><div className="text-xl font-semibold text-green-600">{f.amountDkk + 25} DKK</div></div>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm text-gray-500">Cryptocurrency Amount</div>
              <div className="text-2xl font-bold text-blue-600">{calculatedAmount.toFixed(8)} {f.symbol.toUpperCase()}</div>
              <div className="text-xs text-gray-400 mt-1">Exchange rate: 1 {f.symbol.toUpperCase()} = {currentPrices[f.symbol]?.toFixed(2) || '0.00'} DKK | Last updated: Just now</div>
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
          <button disabled={!selectedWallet || calculatedAmount <= 0 || submitting} onClick={onConfirm}
            className="px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40">
            I have transferred the cryptocurrency
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
