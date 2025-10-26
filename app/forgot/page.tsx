"use client";
import { useState } from 'react';
import { ForgotPasswordSchema, ForgotPasswordInput } from '@/lib/validation';

export default function ForgotPage(){
  const [f,setF]=useState<ForgotPasswordInput>({email:''});
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setValidationErrors({});

    // Validate form
    const validation = ForgotPasswordSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      return;
    }

    const r=await fetch('/api/auth/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});
    const j = await r.json();
    if(!j.ok){ setErr(j.error||'Failed to send reset link'); return; }
    setMsg('If the email exists, a reset link has been sent.');
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Forgot Password</h1>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Email" value={f.email} onChange={e=>setF({email:e.target.value})} />
          {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
        </div>
        <button className="bg-black text-white rounded-2xl px-5 py-3">Send reset link</button>
      </form>
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
