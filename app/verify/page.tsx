"use client";
import { useEffect, useState } from 'react';

export default function VerifyPage({ searchParams }:{ searchParams: { email?: string } }){
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');

  useEffect(()=>{ setEmail(searchParams?.email || ''); },[searchParams]);

  async function onVerify(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg('');
    const res = await fetch('/api/auth/verify',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, code }) });
    const j = await res.json();
    if(!j.ok){ setErr(j.error||'Invalid code'); return; }
    setMsg(j.already? 'Already verified. You can now book rides.' : 'Verified! You can now book rides.');
  }

  async function onResend(){
    setErr(''); setMsg('');
    const r = await fetch('/api/auth/resend-code',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||'Failed to resend'); return; }
    setMsg('A new verification code was sent to your email.');
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Verify Email</h1>
      <form onSubmit={onVerify} className="grid gap-3">
        <input className="border rounded-xl px-4 py-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded-xl px-4 py-3" placeholder="6-digit code" value={code} onChange={e=>setCode(e.target.value)} />
        <div className="flex gap-2">
          <button className="bg-black text-white rounded-2xl px-5 py-3" type="submit">Verify</button>
          <button type="button" className="border rounded-2xl px-5 py-3" onClick={onResend}>Resend code</button>
        </div>
      </form>
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
