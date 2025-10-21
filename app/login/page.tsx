"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setSubmitting(true);
    const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }), credentials:'include' });
    const j = await res.json(); setSubmitting(false);
    if(!j.ok){ setErr(j.error||'Login failed'); return; }
    window.location.href = j.next || '/';
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Login</h1>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="border rounded-xl px-4 py-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded-xl px-4 py-3" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={submitting} className="bg-black text-white rounded-2xl px-5 py-3">{submitting?'Logging in...':'Login'}</button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
      <p className="text-sm text-gray-600">Don’t have an account? <Link href="/register" className="underline">Create one</Link></p>
    </div>
  );
}
