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
 * Server Action that proxies the original booking submission then redirects to /pay?amount_dkk=...
 * It expects a hidden field __orig_action containing the original endpoint (e.g., /api/bookings).
 */
export async function confirmBookingAndGoToPay(form: FormData) {
  // 1) Capture original endpoint (if present)
  const orig = (form.get("__orig_action") || "").toString().trim();
  // Remove our helper field from the outgoing payload
  form.delete("__orig_action");

  // 2) Submit to original endpoint if provided
  let amount = pickAmount(form);
  if (orig) {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || "";
      const res = await fetch(base + orig, { method: "POST", body: form, cache: "no-store" });
      if (res.ok) {
        try {
          const j = await res.json();
          const keys = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount","id"];
          for (const k of keys) {
            const v:any = (j as any)?.[k];
            if (typeof v === "number" && v > 0) { if (!amount) amount = v; }
            if (typeof v === "string") {
              const n = parseFloat(v); if (!Number.isNaN(n) && n > 0) { if (!amount) amount = n; }
            }
          }
        } catch {}
      } else {
        // If the original endpoint failed, surface its error text
        const t = await res.text().catch(()=> "");
        throw new Error(t || "Booking endpoint failed");
      }
    } catch (e:any) {
      console.error("[confirmBookingAndGoToPay] Forward failed:", e?.message || e);
      // Continue to redirect to /pay without amount to avoid blocking user
    }
  }

  // 3) Redirect to /pay, optionally with amount
  const q = amount ? `?amount_dkk=${encodeURIComponent(String(amount))}` : "";
  redirect(`/pay${q}`);
}
