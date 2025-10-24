"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function parseAmountFromForm(form: HTMLFormElement): number | null {
  const names = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const n of names) {
    const el = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${n}"]`);
    if (el && "value" in el) {
      const v = parseFloat((el as any).value);
      if (!Number.isNaN(v) && v > 0) return v;
    }
  }
  return null;
}

function parseAmountFromJSON(j: any): number | null {
  const keys = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const k of keys) {
    const v = j?.[k];
    const num = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return null;
}

function looksLikeBooking(form: HTMLFormElement): boolean {
  const name = (form.getAttribute("name") || "") + " " + (form.getAttribute("id") || "");
  const action = form.getAttribute("action") || (form as any).action || "";
  const hint = (form.getAttribute("data-flow") || "") + " " + (form.getAttribute("data-redirect-to-pay") || "");
  const hay = `${name} ${action} ${hint}`.toLowerCase();
  return /book|booking|reserve|reservation|ride/.test(hay) || form.hasAttribute("data-redirect-after-submit") || form.hasAttribute("data-redirect-to-pay");
}

export default function BookingRedirector(){
  const router = useRouter();

  useEffect(() => {
    async function onSubmit(e: Event){
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;
      if (!looksLikeBooking(form)) return;

      e.preventDefault();

      const action = form.getAttribute("action") || (form as any).action || window.location.pathname;
      const method = (form.getAttribute("method") || (form as any).method || "POST").toUpperCase();
      const fd = new FormData(form);
      let amount = parseAmountFromForm(form);

      try {
        const res = await fetch(action, { method, body: fd as any });
        if (!res.ok) {
          const t = await res.text().catch(()=> "");
          alert(t || "تعذّر إتمام الحجز.");
          return;
        }
        // Try read JSON to extract id/amount
        let id: string | null = null;
        try {
          const j = await res.json();
          if (j && typeof j === "object") {
            id = j.id ? String(j.id) : null;
            if (!amount) amount = parseAmountFromJSON(j);
          }
        } catch { /* response might not be JSON */ }

        // Build target URL
        const q = amount ? `?amount_dkk=${encodeURIComponent(String(amount))}` : "";
        const target = "/pay" + q;

        try { router.push(target); }
        catch { window.location.assign(target); }
      } catch (err) {
        console.error("booking submit failed", err);
        alert("Network error while confirming booking.");
      }
    }

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [router]);

  return null;
}
