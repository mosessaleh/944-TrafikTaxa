"use client";
import { useState } from 'react';
import Link from 'next/link';
import { LoginSchema, LoginInput } from '@/lib/validation';

export default function LoginPage(){
  const [f,setF]=useState<LoginInput>({email:'',password:''});
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setValidationErrors({}); setSubmitting(true);

    // Validate form
    const validation = LoginSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(f), credentials:'include' });
    const j = await res.json(); setSubmitting(false);
    if(!j.ok){ setErr(j.error||'Login failed'); return; }
    window.location.href = j.next || '/';
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Login</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
          {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
        </div>
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Password" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} />
          {validationErrors.password && <span className="text-red-500 text-sm">{validationErrors.password}</span>}
        </div>
        <button disabled={submitting} className="bg-black text-white rounded-2xl px-5 py-3">{submitting?'Logging in...':'Login'}</button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
      <p className="text-sm text-gray-600">Don’t have an account? <Link href="/register" className="underline">Create one</Link></p>
    </div>
  );
}
