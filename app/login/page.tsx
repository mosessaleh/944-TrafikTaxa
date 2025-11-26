"use client";
import { useState } from 'react';
import Link from 'next/link';

interface LoginInput {
  email: string;
  password: string;
  username?: string;
}

export default function LoginPage(){
  const [loginType, setLoginType] = useState<'user' | 'partner'>('user');
  const [f,setF]=useState<LoginInput>({email:'',password:''});
  const [err,setErr]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setValidationErrors({}); setSubmitting(true);

    // Basic validation
    if (loginType === 'user') {
      if (!f.email || !f.password) {
        setValidationErrors({
          email: f.email ? '' : 'Email is required',
          password: f.password ? '' : 'Password is required'
        });
        setSubmitting(false);
        return;
      }
    } else {
      if (!f.username || !f.password) {
        setValidationErrors({
          username: f.username ? '' : 'Username is required',
          password: f.password ? '' : 'Password is required'
        });
        setSubmitting(false);
        return;
      }
    }

    const payload = loginType === 'user'
      ? { email: f.email, password: f.password, type: 'user' }
      : { username: f.username, password: f.password, type: 'partner' };

    const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload), credentials:'include' });
    const j = await res.json(); setSubmitting(false);
    if(!j.ok){ setErr(j.error||'Login failed'); return; }
    window.location.href = j.next || '/';
  }

  return (
    <div className="max-w-md mx-auto grid gap-4">
      <h1 className="text-3xl font-bold">Login</h1>

      {/* Login Type Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => setLoginType('user')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            loginType === 'user'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          User Login
        </button>
        <button
          type="button"
          onClick={() => setLoginType('partner')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            loginType === 'partner'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Partner Company Login
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3">
        {loginType === 'user' ? (
          <div className="grid gap-1">
            <input className="border rounded-xl px-4 py-3" placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
            {validationErrors.email && <span className="text-red-500 text-sm">{validationErrors.email}</span>}
          </div>
        ) : (
          <div className="grid gap-1">
            <input className="border rounded-xl px-4 py-3" placeholder="Username" value={f.username || ''} onChange={e=>setF({...f,username:e.target.value})} />
            {validationErrors.username && <span className="text-red-500 text-sm">{validationErrors.username}</span>}
          </div>
        )}
        <div className="grid gap-1">
          <input className="border rounded-xl px-4 py-3" placeholder="Password" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} />
          {validationErrors.password && <span className="text-red-500 text-sm">{validationErrors.password}</span>}
        </div>
        <button disabled={submitting} className="bg-black text-white rounded-2xl px-5 py-3">{submitting?'Logging in...':'Login'}</button>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </form>
      {loginType === 'user' && (
        <p className="text-sm text-gray-600">Don’t have an account? <Link href="/register" className="underline">Create one</Link></p>
      )}
    </div>
  );
}
