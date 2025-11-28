"use client";
import { useState } from 'react';
import { ProfileUpdateSchema, ProfileUpdateInput } from '@/lib/validation';
import { useCSRF } from '@/lib/useCSRF';

// Import translation files
import dkMessages from '../messages/dk.json';
import enMessages from '../messages/en.json';

// Translation function
function useTranslations() {
  const language = typeof window !== 'undefined' ? (localStorage.getItem('language') || 'dk') : 'dk';

  const t = (key: string) => {
    const keys = key.split('.');
    const messages = language === 'dk' ? dkMessages : enMessages;
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return t;
}

export default function ProfileEditClient({ initial, onProfileUpdate }: { initial: any; onProfileUpdate?: () => void }){
  const [f,setF] = useState<ProfileUpdateInput>(initial);
  const [msg,setMsg] = useState('');
  const [err,setErr] = useState('');
  const [loading,setLoading] = useState(false);
  const [verifyCode,setVerifyCode] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // CSRF token management
  const { csrfToken, loading: csrfLoading, error: csrfError } = useCSRF();
  const t = useTranslations();

  async function onSave(e:React.FormEvent){
    e.preventDefault(); setMsg(''); setErr(''); setValidationErrors({}); setLoading(true);

    // Check CSRF token availability
    if (!csrfToken) {
      setErr(t('account.profile.securityTokenNotAvailable'));
      setLoading(false);
      return;
    }

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
    const res = await fetch('/api/profile/update', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-csrf-token': csrfToken // Include CSRF token
      },
      credentials:'include',
      body: JSON.stringify({
        email: f.email,
        firstName: f.firstName,
        lastName: f.lastName,
        phone: f.phone,
        address: f.address
      })
    });
      const j = await res.json();
      if(!j.ok){ setErr(j.error||t('account.profile.updateFailed')); return; }
      if (j.pending){ setMsg(t('account.profile.verificationCodeSent')); }
      else {
        setMsg(t('account.profile.profileUpdated'));
        onProfileUpdate?.();
      }
    }catch(ex:any){ setErr(ex?.message||'Unexpected error'); }
    finally{ setLoading(false); }
  }

  async function onVerifyNewEmail(e:React.FormEvent){
    e.preventDefault(); setMsg(''); setErr('');
    const r = await fetch('/api/profile/verify-new-email', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: f.email, code: verifyCode }) });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||t('account.profile.verificationFailed')); return; }
    setMsg(t('account.profile.emailUpdatedVerified'));
    onProfileUpdate?.();
    setTimeout(()=>{ window.location.reload(); }, 800);
  }

  async function onResend(){
    setErr(''); setMsg('');
    const r = await fetch('/api/profile/resend-new-email', { method:'POST', headers:{'Content-Type':'application/json'} });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||t('account.profile.failedToResend')); return; }
    setMsg(t('account.profile.newCodeSent'));
  }

  async function onResendVerification(){
    setErr(''); setMsg('');
    const r = await fetch('/api/auth/resend-code', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: initial.email })
    });
    const j = await r.json();
    if(!j.ok){ setErr(j.error||t('account.profile.failedToResendVerification')); return; }
    setMsg(t('account.profile.newVerificationCodeSent'));
  }

  return (
    <section className="grid gap-4 bg-white border rounded-2xl p-6">
      <h2 className="text-xl font-semibold">{t('account.profile.editProfile')}</h2>
      <form onSubmit={onSave} className="grid md:grid-cols-2 gap-3">
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">{t('account.profile.emailHint')}</span>
          <input className="border rounded-xl px-4 py-3" value={f.email} onChange={e=>setF({ ...f, email:e.target.value })} />
          {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">{t('account.profile.firstName')}</span>
          <input className="border rounded-xl px-4 py-3" value={f.firstName} onChange={e=>setF({ ...f, firstName:e.target.value })} />
          {validationErrors.firstName && <span className="text-red-500 text-sm">{validationErrors.firstName}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">{t('account.profile.lastName')}</span>
          <input className="border rounded-xl px-4 py-3" value={f.lastName} onChange={e=>setF({ ...f, lastName:e.target.value })} />
          {validationErrors.lastName && <span className="text-red-500 text-sm">{validationErrors.lastName}</span>}
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">{t('account.profile.phone')}</span>
          <input className="border rounded-xl px-4 py-3" value={f.phone} onChange={e=>setF({ ...f, phone:e.target.value })} />
          {validationErrors.phone && <span className="text-red-500 text-sm">{validationErrors.phone}</span>}
        </label>
        <label className="grid gap-1 md:col-span-2">
          <span className="text-sm text-gray-600">{t('account.profile.address')}</span>
          <input className="border rounded-xl px-4 py-3" value={f.address || ''} onChange={e=>setF({ ...f, address:e.target.value })} />
          {validationErrors.address && <span className="text-red-500 text-sm">{validationErrors.address}</span>}
        </label>
        <button disabled={loading || !csrfToken} className="bg-black text-white rounded-2xl px-5 py-3 md:col-span-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? t('account.profile.saving') : !csrfToken ? t('account.profile.loadingSecurityToken') : t('account.profile.saveChanges')}
        </button>
      </form>

      {/* CSRF Error Display */}
      {csrfError && (
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded-lg border border-red-200">
          {t('account.profile.securityError')}: {csrfError}
        </div>
      )}

      {/* Email verification status */}
      {(!initial.emailVerified || initial.emailVerified === 0 || initial.emailVerified === "0") && !initial.pendingEmail && (
        <div className="grid gap-2 border rounded-xl p-4 bg-orange-50 border-orange-200">
          <div className="font-medium text-orange-800">{t('account.profile.emailNotVerified')}</div>
          <div className="text-sm text-orange-700">
            {t('account.profile.verifyEmail').replace('{email}', `<b>${initial.email}</b>`)}
          </div>
          <button
            type="button"
            onClick={onResendVerification}
            className="px-4 py-2 rounded-xl border border-orange-300 bg-orange-600 text-white hover:bg-orange-700 transition-colors w-fit"
          >
            {t('account.profile.sendVerification')}
          </button>
        </div>
      )}

      {initial.pendingEmail && (
        <div className="grid gap-2 border rounded-xl p-4 bg-yellow-50">
          <div className="font-medium">{t('account.profile.pendingEmailChange')}</div>
          <div className="text-sm text-gray-700">{t('account.profile.pendingEmailDesc').replace('{email}', `<b>${initial.pendingEmail}</b>`)}</div>
          <form onSubmit={onVerifyNewEmail} className="flex gap-2 items-center">
            <input className="border rounded-xl px-4 py-2" placeholder={t('account.profile.sixDigitCode')} value={verifyCode} onChange={e=>setVerifyCode(e.target.value)} />
            <button className="px-4 py-2 rounded-xl border bg-black text-white">{t('account.profile.verifyNewEmail')}</button>
            <button type="button" onClick={onResend} className="px-4 py-2 rounded-xl border">{t('account.profile.resendCode')}</button>
          </form>
        </div>
      )}

      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </section>
  );
}
