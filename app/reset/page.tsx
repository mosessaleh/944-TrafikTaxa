"use client";
import { useEffect, useState } from 'react';
import { ResetPasswordSchema, ResetPasswordInput } from '@/lib/validation';

export default function ResetPage({ searchParams }:{ searchParams:{ token?:string } }){
  const [f,setF]=useState<ResetPasswordInput>({token:'',password:''});
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(()=>{ setF({...f, token: searchParams?.token||''}); },[searchParams]);

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg(''); setValidationErrors({});

    // Validate form
    const validation = ResetPasswordSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      return;
    }

    const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)});
    const j=await r.json();
    if(j.ok){ setMsg('Password updated!'); }
    else { setErr('Failed: '+(j.error||'')); }
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Reset Password</h1>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Token" value={f.token} onChange={e=>setF({...f,token:e.target.value})} />
          {validationErrors.token && <span className="text-red-500 text-sm">{validationErrors.token}</span>}
        </div>
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" type="password" placeholder="New password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} />
          {validationErrors.password && <span className="text-red-500 text-sm">{validationErrors.password}</span>}
        </div>
        <button className="bg-black text-white rounded-2xl px-5 py-3">Update</button>
      </form>
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
