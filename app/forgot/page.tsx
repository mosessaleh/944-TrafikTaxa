"use client";
import { useState } from 'react';

export default function ForgotPage(){
  const [email,setEmail]=useState('');
  const [msg,setMsg]=useState('');
  async function submit(e:React.FormEvent){ e.preventDefault(); const r=await fetch('/api/auth/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})}); setMsg('If the email exists, a reset link has been sent.'); }
  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Forgot Password</h1>
      <form onSubmit={submit} className="grid gap-3">
        <input className="border rounded-xl px-4 py-3" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <button className="bg-black text-white rounded-2xl px-5 py-3">Send reset link</button>
      </form>
      {msg && <p className="text-green-600">{msg}</p>}
    </div>
  );
}
