"use client";
import { useEffect, useState } from 'react';

interface VerifyEmailInput {
  email: string;
  code: string;
}

export default function VerifyPage({ searchParams }:{ searchParams: { email?: string } }){
  const [f,setF]=useState<VerifyEmailInput>({email:'',code:''});
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(()=>{ setF({...f, email: searchParams?.email || ''}); },[searchParams]);

  async function onVerify(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setValidationErrors({});

    // Basic validation
    if (!f.email || !f.code) {
      setValidationErrors({
        email: f.email ? '' : 'Email is required',
        code: f.code ? '' : 'Verification code is required'
      });
      return;
    }
    if (f.code.length !== 6 || !/^\d{6}$/.test(f.code)) {
      setValidationErrors({
        code: 'Code must be exactly 6 digits'
      });
      return;
    }

    const res = await fetch('/api/auth/verify',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(f) });
    const j = await res.json();
    if(!j.ok){ setErr(j.error||'Invalid code'); return; }
    setMsg(j.already? 'Already verified. You can now book rides.' : 'Verified! You can now book rides.');
  }

  async function onResend(){
    setErr(''); setMsg('');
    const r = await fetch('/api/auth/resend-code',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: f.email }) });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||'Failed to resend'); return; }
    setMsg('A new verification code was sent to your email.');
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Verify Email</h1>
      <form onSubmit={onVerify} className="grid gap-3">
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
          {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
        </div>
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="6-digit code" value={f.code} onChange={e=>setF({...f,code:e.target.value})} />
          {validationErrors.code && <span className="text-red-500 text-sm">{validationErrors.code}</span>}
        </div>
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
