"use client";
import { useState } from 'react';

export default function RegisterPage(){
  const [f,setF]=useState({email:'',password:'',firstName:'',lastName:'',phone:'',street:'',houseNumber:'',postalCode:'',city:''});
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try{
      const res = await fetch('/api/auth/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        cache:'no-store',
        body:JSON.stringify(f)
      });
      // حاول قراءة JSON بأمان
      let j:any = {};
      try { j = await res.json(); } catch { j = { ok: res.ok }; }
      if(!res.ok || !j.ok){
        setErr(j.error || `Registration failed (${res.status})`);
        return;
      }
      // تحويل صريح للصفحة التالية مع تمرير الإيميل
      const next = j.next || `/verify?email=${encodeURIComponent(f.email)}`;
      window.location.href = next;
    }catch(ex:any){
      setErr(ex?.message || 'Unexpected error while registering');
    }finally{
      // في حال ما تم التحويل لأي سبب، رجّع الزر لوضعه الطبيعي
      setTimeout(()=>setSubmitting(false), 300);
    }
  }

  return (
    <div className="max-w-2xl mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Create Account</h1>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">Email</span>
          <input className="border rounded-xl px-4 py-3" value={f.email} onChange={e=>setF({...f,email:e.target.value})} placeholder="you@example.com" />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">Password (min 8)</span>
          <input className="border rounded-xl px-4 py-3" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">First name</span>
          <input className="border rounded-xl px-4 py-3" value={f.firstName} onChange={e=>setF({...f,firstName:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Last name</span>
          <input className="border rounded-xl px-4 py-3" value={f.lastName} onChange={e=>setF({...f,lastName:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Phone</span>
          <input className="border rounded-xl px-4 py-3" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Street</span>
          <input className="border rounded-xl px-4 py-3" value={f.street} onChange={e=>setF({...f,street:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">House No.</span>
          <input className="border rounded-xl px-4 py-3" value={f.houseNumber} onChange={e=>setF({...f,houseNumber:e.target.value})} />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Postal code</span>
          <input className="border rounded-xl px-4 py-3" value={f.postalCode} onChange={e=>setF({...f,postalCode:e.target.value})} />
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">City</span>
          <input className="border rounded-xl px-4 py-3" value={f.city} onChange={e=>setF({...f,city:e.target.value})} />
        </label>
        <button disabled={submitting} className="bg-black text-white rounded-2xl px-5 py-3 md:col-span-2">{submitting? 'Registering...' : 'Register'}</button>
      </form>
      {err && <p className="text-red-600">{err}</p>}
    </div>
  );
}
