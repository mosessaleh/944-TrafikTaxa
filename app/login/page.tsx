"use client";
import { useState } from 'react';
import Link from 'next/link';

interface LoginInput {
  email: string;
  password: string;
}

export default function LoginPage(){
  const [f,setF]=useState<LoginInput>({email:'',password:''});
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setValidationErrors({}); setSubmitting(true);

    // Basic validation
    if (!f.email || !f.password) {
      setValidationErrors({
        email: f.email ? '' : 'Email is required',
        password: f.password ? '' : 'Password is required'
      });
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
