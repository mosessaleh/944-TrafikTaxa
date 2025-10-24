"use client";
import { useState } from "react";

export default function PayByCard(){
  const [amount, setAmount] = useState<string>("");

  async function mockConfirm(){
    const res = await fetch("/api/payments/card/mock-confirm", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ amountDkk: Number(amount) || 0 })
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    alert("تم الدفع بالبطاقة (محاكاة). سيتم تأكيد الحجز خلال 5 دقائق.");
  }

  return (
    <div className="max-w-xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Pay by Card</h1>

      <label className="grid gap-1">
        <span className="text-sm text-gray-500">Amount (DKK)</span>
        <input value={amount} onChange={e=>setAmount(e.target.value)} type="number" className="rounded-xl border px-3 py-2" />
      </label>

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-xl border bg-black text-white" onClick={mockConfirm}>
          محاكاة الدفع الآن
        </button>
      </div>

      <div className="text-sm text-gray-500">
        ستتم المعالجة خلال 5 دقائق وسيتم إرسال إشعارات للمستخدم والإدمن.
      </div>
    </div>
  );
}
