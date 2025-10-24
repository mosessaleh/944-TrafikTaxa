"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client fallback: If a page is a Client Component and we cannot use Server Actions for the form,
 * we listen for a custom event 'booking:confirmed' or rely on data-redirect-to-pay attribute.
 * You can dispatch window.dispatchEvent(new CustomEvent('booking:confirmed', { detail: { amount_dkk: 250 } }))
 * from your existing client code after booking success.
 */
export default function BookingClientFallback(){
  const router = useRouter();
  useEffect(()=>{
    const onEvt = (e:any) => {
      const amt = e?.detail?.amount_dkk || null;
      const q = amt ? `?amount_dkk=${encodeURIComponent(String(amt))}` : "";
      const target = `/pay${q}`;
      try { router.push(target); } catch { window.location.assign(target); }
    };
    window.addEventListener("booking:confirmed", onEvt as any);
    return ()=> window.removeEventListener("booking:confirmed", onEvt as any);
  }, [router]);
  return null;
}
