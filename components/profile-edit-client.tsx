"use client";
import { useState } from 'react';
import { ProfileUpdateSchema, ProfileUpdateInput } from '@/lib/validation';

export default function ProfileEditClient({ initial }: { initial: any }){
  const [f,setF] = useState<ProfileUpdateInput>(initial);
  const [msg,setMsg] = useState('');
  const [err,setErr] = useState('');
  const [loading,setLoading] = useState(false);
  const [verifyCode,setVerifyCode] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function onSave(e:React.FormEvent){
    e.preventDefault(); setMsg(''); setErr(''); setValidationErrors({}); setLoading(true);

    // Validate form
    const validation = ProfileUpdateSchema.safeParse(f);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setValidationErrors(errors);
      setLoading(false);
      return;
    }

    try{
      const res = await fetch('/api/profile/update', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        phone: f.phone,
        street: f.street,
        houseNumber: f.houseNumber,
        postalCode: f.postalCode,
        city: f.city
      }) });
      const j = await res.json();
      if(!j.ok){ setErr(j.error||'Update failed'); return; }
      if (j.pending){ setMsg('Verification code sent to your new email. Please verify below.'); }
      else { setMsg('Profile updated successfully.'); }
    }catch(ex:any){ setErr(ex?.message||'Unexpected error'); }
    finally{ setLoading(false); }
  }

  async function onVerifyNewEmail(e:React.FormEvent){
    e.preventDefault(); setMsg(''); setErr('');
    const r = await fetch('/api/profile/verify-new-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: f.email, code: verifyCode }) });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||'Verification failed'); return; }
    setMsg('Email updated and verified successfully.');
    setTimeout(()=>{ window.location.reload(); }, 800);
  }

  async function onResend(){
    setErr(''); setMsg('');
    const r = await fetch('/api/profile/resend-new-email', { method:'POST', headers:{'Content-Type':'application/json'} });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||'Failed to resend'); return; }
    setMsg('A new code has been sent to your new email.');
  }

  return (
    <section className="grid gap-4 bg-white border rounded-2xl p-6">
      <h2 className="text-xl font-semibold">Edit profile</h2>
      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3">
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">Email (changing it will require verification)</span>
          <input className="border rounded-xl px-4 py-3" value={f.email} onChange={e=>setF({ ...f, email:e.target.value })} />
          {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">First name</span>
          <input className="border rounded-xl px-4 py-3" value={f.firstName} onChange={e=>setF({ ...f, firstName:e.target.value })} />
          {validationErrors.firstName && <span className="text-red-500 text-sm">{validationErrors.firstName}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Last name</span>
          <input className="border rounded-xl px-4 py-3" value={f.lastName} onChange={e=>setF({ ...f, lastName:e.target.value })} />
          {validationErrors.lastName && <span className="text-red-500 text-sm">{validationErrors.lastName}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Phone</span>
          <input className="border rounded-xl px-4 py-3" value={f.phone} onChange={e=>setF({ ...f, phone:e.target.value })} />
          {validationErrors.phone && <span className="text-red-500 text-sm">{validationErrors.phone}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Street</span>
          <input className="border rounded-xl px-4 py-3" value={f.street} onChange={e=>setF({ ...f, street:e.target.value })} />
          {validationErrors.street && <span className="text-red-500 text-sm">{validationErrors.street}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">House No.</span>
          <input className="border rounded-xl px-4 py-3" value={f.houseNumber} onChange={e=>setF({ ...f, houseNumber:e.target.value })} />
          {validationErrors.houseNumber && <span className="text-red-500 text-sm">{validationErrors.houseNumber}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Postal code</span>
          <input className="border rounded-xl px-4 py-3" value={f.postalCode} onChange={e=>setF({ ...f, postalCode:e.target.value })} />
          {validationErrors.postalCode && <span className="text-red-500 text-sm">{validationErrors.postalCode}</span>}
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">City</span>
          <input className="border rounded-xl px-4 py-3" value={f.city} onChange={e=>setF({ ...f, city:e.target.value })} />
          {validationErrors.city && <span className="text-red-500 text-sm">{validationErrors.city}</span>}
        </label>
        <button disabled={loading} className="bg-black text-white rounded-2xl px-5 py-3 md:col-span-2">{loading ? 'Saving...' : 'Save changes'}</button>
      </form>

      {initial.pendingEmail && (
        <div className="grid gap-2 border rounded-xl p-4 bg-yellow-50">
          <div className="font-medium">Pending email change</div>
          <div className="text-sm text-gray-700">We sent a 6-digit code to <b>{initial.pendingEmail}</b>. Enter it below to confirm the new email.</div>
          <form onSubmit={onVerifyNewEmail} className="flex gap-2 items-center">
            <input className="border rounded-xl px-4 py-2" placeholder="6-digit code" value={verifyCode} onChange={e=>setVerifyCode(e.target.value)} />
            <button className="px-4 py-2 rounded-xl border bg-black text-white">Verify new email</button>
            <button type="button" onClick={onResend} className="px-4 py-2 rounded-xl border">Resend code</button>
          </form>
        </div>
      )}

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </section>
  );
}
