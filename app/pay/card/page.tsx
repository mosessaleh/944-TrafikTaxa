"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import ErrorBoundary from "@/components/error-boundary";
import { CardPaymentSchema, CardPaymentInput } from '@/lib/validation';

export default function PayByCard(){
  const [f, setF] = useState<CardPaymentInput>({amountDkk: 0});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function mockConfirm(){
    setValidationErrors({});

    // Validate form
    const validation = CardPaymentSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      return;
    }

    const res = await fetch("/api/payments/card/mock-confirm", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(f)
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success("تم الدفع بالبطاقة (محاكاة). سيتم تأكيد الحجز خلال 5 دقائق.");
  }

  return (
    <ErrorBoundary>
      <div className="max-w-xl mx-auto p-6 grid gap-6">
        <h1 className="text-2xl font-bold">Pay by Card</h1>

        <label className="grid gap-1">
          <span className="text-sm text-gray-500">Amount (DKK)</span>
          <input value={f.amountDkk} onChange={e=>setF({amountDkk: Number(e.target.value) || 0})} type="number" className="rounded-xl border px-3 py-2" />
          {validationErrors.amountDkk && <span className="text-red-500 text-sm">{validationErrors.amountDkk}</span>}
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
    </ErrorBoundary>
  );
}
