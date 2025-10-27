"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function PayIndexContent(){
  const router = useRouter();
  const sp = useSearchParams();
  const amount = sp.get("amount_dkk") || "";
  const bookingId = sp.get("booking_id") || "";

  console.log("PayIndex: Loaded with params", { amount, bookingId });

  const [method, setMethod] = useState<"card"|"crypto"|null>(null);

  const handlePaymentMethod = async (selectedMethod: "card" | "crypto") => {
    if (!amount) {
      console.error("PayIndex: No amount specified");
      alert("No amount specified. Please go back and try booking again.");
      return;
    }

    const q = `?amount_dkk=${encodeURIComponent(amount)}${bookingId ? `&booking_id=${encodeURIComponent(bookingId)}` : ''}`;
    console.log("PayIndex: Redirecting to payment method", { selectedMethod, query: q });
    router.push(`/pay/${selectedMethod}${q}`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Choose Payment Method</h1>

      {amount && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">Amount to Pay</div>
            <div className="text-2xl font-bold text-blue-800">{amount} DKK</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => handlePaymentMethod("card")}
          className={`rounded-2xl border p-6 text-left transition hover:shadow-md ${method==="card"?"ring-2 ring-blue-500":""}`}
        >
          <div className="text-lg font-semibold">💳 Pay by Card</div>
          <div className="text-sm text-gray-500 mt-1">Visa / Mastercard / American Express</div>
          <div className="text-xs text-gray-400 mt-2">Secure payment through Stripe or Revolut</div>
        </button>
        <button
          onClick={() => handlePaymentMethod("crypto")}
          className={`rounded-2xl border p-6 text-left transition hover:shadow-md ${method==="crypto"?"ring-2 ring-orange-500":""}`}
        >
          <div className="text-lg font-semibold">₿ Pay with Crypto</div>
          <div className="text-sm text-gray-500 mt-1">USDT / USDC / BTC / PI / ETH / BNB / XRP</div>
          <div className="text-xs text-gray-400 mt-2">Direct wallet payments</div>
        </button>
      </div>

      <div className="text-center text-sm text-gray-600">
        Your booking will be confirmed only after successful payment.
      </div>
    </div>
  );
}

export default function PayIndex(){
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-6"><div className="text-center">Loading...</div></div>}>
      <PayIndexContent />
    </Suspense>
  );
}
