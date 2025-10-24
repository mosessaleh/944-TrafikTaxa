"use client";
import { useEffect, useRef, useState } from "react";
import BookingPayModal from "@/app/_components/BookingPayModal";

/**
 * Extremely strict EU-style parsing:
 * - Remove ALL dots from number chunk (treat them as thousands separators always)
 * - Treat comma as decimal separator
 * Examples:
 *   "1.050 kr." -> 1050
 *   "1.050,75 DKK" -> 1050.75
 *   "435 kr." -> 435
 *   "435,50" -> 435.5
 */
function parseNumberCandidate(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s+/g, " ").trim();

  // Prefer number near currency label (supports "kr.")
  const curr = /(?:(?:dkk|kr)\.?\s*([0-9][0-9\s\.,]*))|(([0-9][0-9\s\.,]*)\s*(?:dkk|kr)\.?)/i;
  const m = cleaned.match(curr);
  let raw: string | null = m ? (m[1] || m[2] || "").trim() : null;
  if (!raw) {
    const m2 = cleaned.match(/([0-9][0-9\s\.,]*)/);
    raw = m2 ? m2[1] : null;
  }
  if (!raw) return null;

  // 1) Remove spaces
  let n = raw.replace(/\s/g, "");
  // 2) Remove ALL dots (treat as thousands)
  n = n.replace(/\./g, "");
  // 3) Convert commas to decimal point
  n = n.replace(/,/g, ".");

  const num = parseFloat(n);
  if (!Number.isNaN(num) && num > 0) return num;
  return null;
}

function isVisible(el: Element): boolean {
  const h = el as HTMLElement;
  const style = getComputedStyle(h);
  if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
  if (!h.offsetParent && style.position !== "fixed") return false;
  return true;
}

function scoreElement(el: HTMLElement, text: string): number {
  let score = 0;
  const fs = parseFloat(getComputedStyle(el).fontSize || "0");
  score += Math.min(fs, 64);
  const cls = el.className || "";
  if (/price|total|fare|amount/i.test(cls)) score += 20;
  const near = (el.parentElement?.textContent || "").toLowerCase();
  if (near.includes("estimated price") || near.includes("price") || near.includes("total")) score += 15;
  let anc = el.parentElement;
  let hops = 0;
  while (anc && hops < 2) {
    const t = (anc.textContent || "").toLowerCase();
    if (t.includes("estimated price")) { score += 25; break; }
    anc = anc.parentElement;
    hops++;
  }
  if (/kr\.?|dkk/i.test(text)) score += 30;
  return score;
}

function detectAmountFromDOM(): number | null {
  // 1) Inputs first
  const inputNames = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const n of inputNames) {
    const el = document.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${n}"]`);
    if (el && "value" in el) {
      const v = parseFloat((el as any).value);
      if (!Number.isNaN(v) && v > 0) return v;
    }
  }
  // 2) Data attributes / IDs
  const idSelectors = ["#ride-amount","#total-amount","#fare-amount","#price-amount","#booking-total"];
  for (const sel of idSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) {
      const num = parseNumberCandidate(el.textContent || "");
      if (num) return num;
      const dataNum = parseFloat((el.getAttribute("data-ride-amount") || el.getAttribute("data-total-amount") || el.getAttribute("data-price-amount") || ""));
      if (!Number.isNaN(dataNum) && dataNum > 0) return dataNum;
    }
  }
  const dataSelectors = ["[data-ride-amount]","[data-total-amount]","[data-price-amount]","[data-fare-amount]"];
  for (const sel of dataSelectors) {
    const list = document.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(list)) {
      const ds = (el as any).dataset || {};
      const v = ds.rideAmount || ds.totalAmount || ds.priceAmount || ds.fareAmount;
      const num = parseFloat(v || "");
      if (!Number.isNaN(num) && num > 0) return num;
      const fromText = parseNumberCandidate(el.textContent || "");
      if (fromText) return fromText;
    }
  }
  // 3) Visible DOM scan with scoring
  const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  let best: { score: number; val: number } | null = null;
  for (const el of all) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || "").trim();
    if (!text) continue;
    if (!/(kr\.?|dkk|price|total|fare)/i.test(text)) continue;
    const val = parseNumberCandidate(text);
    if (!val) continue;
    const score = scoreElement(el, text);
    if (!best || score > best.score) best = { score, val };
  }
  if (best) return best.val;

  // 4) Fallback near focused button
  const btn = document.querySelector("button:focus") || (document.activeElement as HTMLElement | null);
  const container = btn?.closest?.("form, section, div") || document.body;
  const candidates = container ? Array.from(container.querySelectorAll<HTMLElement>("strong, b, .text-xl, .text-2xl, .font-bold, [class*=price], [class*=total]")) : [];
  for (const el of candidates) {
    const num = parseNumberCandidate(el.textContent || "");
    if (num) return num;
  }
  return null;
}

export default function GlobalBookingModalManager(){
  const [open, setOpen] = useState(false);
  const lastBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const btn = (ev.target as HTMLElement)?.closest?.("button");
      if (!btn) return;
      if ((window as any).__bookingBypassHijack) return;
      const txt = (btn.textContent || "").trim().toLowerCase();
      const isConfirm = /confirm\s*booking/.test(txt) || /تأكيد/.test(txt);
      if (!isConfirm) return;
      ev.preventDefault();
      ev.stopImmediatePropagation?.();
      ev.stopPropagation();

      const amt = detectAmountFromDOM();
      (window as any).__bookingAmountDKK = (amt && amt > 0) ? amt : null;

      lastBtnRef.current = btn as HTMLButtonElement;
      setOpen(true);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  async function onPaid(){
    const btn = lastBtnRef.current;
    setOpen(false);
    if (btn) {
      (window as any).__bookingBypassHijack = true;
      try { btn.click(); } finally {
        setTimeout(()=>{ (window as any).__bookingBypassHijack = false; }, 0);
      }
    }
  }

  return (
    <BookingPayModal open={open} onClose={()=>setOpen(false)} onPaid={onPaid} />
  );
}
