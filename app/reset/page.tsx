"use client";
import { useEffect, useState } from 'react';

export default function ResetPage({ searchParams }:{ searchParams:{ token?:string } }){
  const [token,setToken]=useState('');
  const [password,setPassword]=useState('');
  const [msg,setMsg]=useState('');
  useEffect(()=>{ setToken(searchParams?.token||''); },[searchParams]);
  async function submit(e:React.FormEvent){ e.preventDefault(); const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})}); const j=await r.json(); setMsg(j.ok?'Password updated!':'Failed: '+(j.error||'')); }
  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Reset Password</h1>
      <form onSubmit={submit} className="grid gap-3">
        <input className="border rounded-xl px-4 py-3" placeholder="Token" value={token} onChange={e=>setToken(e.target.value)} />
        <input className="border rounded-xl px-4 py-3" type="password" placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="bg-black text-white rounded-2xl px-5 py-3">Update</button>
      </form>
      {msg && <p className="text-green-600">{msg}</p>}
    </div>
  );
}
