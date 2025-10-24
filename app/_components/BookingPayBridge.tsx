"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function extractAmount(obj: any): number | null {
  if (!obj || typeof obj !== "object") return null;
  const keys = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const k of keys) {
    const v = obj[k];
    const num = typeof v === "string" ? parseFloat(v) : (typeof v === "number" ? v : NaN);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return null;
}

function extractAmountFromInputs(): number | null {
  const names = ["amount_dkk","price_dkk","total_dkk","fare_dkk","total","price","fare","amount"];
  for (const n of names) {
    const el = document.querySelector<HTMLInputElement>(`[name="${n}"]`);
    if (el) {
      const num = parseFloat(el.value);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function shouldWatch(url: string): boolean {
  const u = url.toLowerCase();
  return /(book|booking|reserve|reservation|ride)/.test(u);
}

export default function BookingPayBridge(){
  const router = useRouter();

  useEffect(() => {
    // Avoid double wiring
    if ((window as any).__bookingPayBridgeInstalled) return;
    (window as any).__bookingPayBridgeInstalled = true;
    let redirected = false;
    const go = (amount: number | null) => {
      if (redirected) return;
      redirected = true;
      const q = amount ? `?amount_dkk=${encodeURIComponent(String(amount))}` : "";
      const target = `/pay${q}`;
      try { router.push(target); }
      catch { window.location.assign(target); }
    };

    // Patch fetch
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args: any[]) => {
      try {
        const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
        const init = (args[1] || {}) as RequestInit;
        const method = (init.method || "GET").toUpperCase();
        const res: Response = await origFetch(...args);
        if (!redirected && method !== "GET" && shouldWatch(url) && res.ok) {
          try {
            const clone = res.clone();
            const json = await clone.json().catch(() => null);
            const amount = extractAmount(json) ?? extractAmountFromInputs();
            go(amount);
          } catch {
            const amount = extractAmountFromInputs();
            go(amount);
          }
        }
        return res;
      } catch (e) {
        return origFetch(...args);
      }
    };

    // Patch XHR
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    let currentUrl = "";
    XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
      (this as any).__isBooking = shouldWatch(url) && String(method).toUpperCase() !== "GET";
      currentUrl = url;
      return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body?: any) {
      const xhr = this as XMLHttpRequest & { __isBooking?: boolean };
      const onReady = () => {
        if (xhr.readyState === 4 && xhr.__isBooking && xhr.status >= 200 && xhr.status < 300) {
          try {
            const ct = xhr.getResponseHeader("content-type") || "";
            if (ct.includes("application/json")) {
              const json = JSON.parse(xhr.responseText);
              const amount = extractAmount(json) ?? extractAmountFromInputs();
              go(amount);
            } else {
              const amount = extractAmountFromInputs();
              go(amount);
            }
          } catch {
            const amount = extractAmountFromInputs();
            go(amount);
          }
        }
      };
      xhr.addEventListener("readystatechange", onReady);
      return origSend.call(this, body as any);
    };

    return () => {
      // No-op unpatch to keep behavior during session
    };
  }, [router]);

  return null;
}
