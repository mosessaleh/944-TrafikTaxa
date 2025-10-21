"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ClientNav(){
  const [me,setMe]=useState<any>(null);
  useEffect(()=>{
    fetch('/api/auth/me', { credentials:'include', cache:'no-store' })
      .then(r=>r.ok?r.json():null)
      .then(j=>setMe(j?.user||null))
      .catch(()=>{});
  },[]);

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST', credentials:'include'});
    location.href='/';
  }

  if(!me){
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="px-3 py-1.5 rounded-xl border">Login</Link>
        <Link href="/register" className="px-3 py-1.5 rounded-xl border bg-black text-white">Register</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Show Book/History only if email is verified */}
      {me.emailVerified && <Link href="/book" className="hover:underline">Book</Link>}
      {me.emailVerified && <Link href="/bookings" className="hover:underline">History</Link>}
      <Link href="/profile" className="hover:underline">Profile</Link>
      {me.role === 'ADMIN' && <Link href="/admin" className="hover:underline">Admin</Link>}
      <button onClick={logout} className="px-3 py-1.5 rounded-xl border">Logout</button>
    </div>
  );
}
