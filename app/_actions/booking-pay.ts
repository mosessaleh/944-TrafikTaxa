"use server";
import { redirect } from "next/navigation";

function pickAmount(form: FormData): number | null {
  const keys = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const k of keys) {
    const v = form.get(k);
    const num = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return null;
}

/**
 * Server Action that redirects to payment selection page with amount
 * The booking should NOT be created until payment is confirmed
 */
export async function confirmBookingAndGoToPay(form: FormData) {
  // Extract amount from form data
  const amount = pickAmount(form);

  // Redirect to payment selection page with amount
  const q = amount ? `?amount_dkk=${encodeURIComponent(String(amount))}` : "";
  redirect(`/pay${q}`);
}
