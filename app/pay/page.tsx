"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function PayIndex(){
  const router = useRouter();
  const sp = useSearchParams();
  const amount = sp.get("amount_dkk") || "";

  const [method, setMethod] = useState<"card"|"crypto"|null>(null);

  return (
    <div className="max-w-3xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Choose Payment Method</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={()=>setMethod("card")} className={`rounded-2xl border p-6 text-left ${method==="card"?"ring-2 ring-blue-500":""}`}>
          <div className="text-lg font-semibold">Pay by Card</div>
          <div className="text-sm text-gray-500 mt-1">Visa / Mastercard</div>
        </button>
        <button onClick={()=>setMethod("crypto")} className={`rounded-2xl border p-6 text-left ${method==="crypto"?"ring-2 ring-blue-500":""}`}>
          <div className="text-lg font-semibold">Pay with Crypto</div>
          <div className="text-sm text-gray-500 mt-1">USDT / USDC / BTC / PI</div>
        </button>
      </div>

      <div className="flex gap-3">
        <button
          disabled={!method}
          onClick={() => {
            if (!method) return;
            const q = amount ? `?amount_dkk=${encodeURIComponent(amount)}` : "";
            router.push(`/pay/${method}${q}`);
          }}
          className="px-4 py-2 rounded-xl border bg-black text-white disabled:opacity-40"
        >
          Continue
        </button>
        <input
          type="number"
          placeholder="Ride price (DKK)"
          defaultValue={amount}
          onChange={(e)=>{
            const v = e.currentTarget.value;
            const q = v ? `?amount_dkk=${encodeURIComponent(v)}` : "";
            window.history.replaceState(null, "", `/pay${q}`);
          }}
          className="rounded-xl border px-3 py-2"
        />
      </div>
    </div>
  );
}
