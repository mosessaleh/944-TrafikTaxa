"use client";
import { useState } from "react";

export default function PayByCard(){
  const [amount, setAmount] = useState<string>("");
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

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
    alert("تم استلام دفعتك (محاكاة). سيتم تأكيد الحجز خلال 5 دقائق.");
  }

  return (
    <div className="max-w-xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Pay by Card</h1>

      {!stripeKey && (
        <div className="p-4 rounded-xl border bg-yellow-50 text-yellow-900">
          <div className="font-semibold">Stripe غير مفعّل</div>
          <div className="text-sm mt-1">أضف مفاتيح Stripe إلى <code>.env</code> لتفعيل الدفع الحقيقي.</div>
        </div>
      )}

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
        ملاحظة: هذه صفحة محاكاة. عند تفعيل Stripe/QuickPay سنستبدل هذا النموذج بواجهة الدفع الحقيقية.
      </div>
    </div>
  );
}
