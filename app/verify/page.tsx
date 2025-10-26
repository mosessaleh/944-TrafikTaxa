"use client";
import { useEffect, useState } from 'react';
import { VerifyEmailSchema, VerifyEmailInput } from '@/lib/validation';

export default function VerifyPage({ searchParams }:{ searchParams: { email?: string } }){
  const [f,setF]=useState<VerifyEmailInput>({email:'',code:''});
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(()=>{ setF({...f, email: searchParams?.email || ''}); },[searchParams]);

  async function onVerify(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setValidationErrors({});

    // Validate form
    const validation = VerifyEmailSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
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
