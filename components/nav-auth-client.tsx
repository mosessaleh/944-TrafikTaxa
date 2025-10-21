"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function NavLinks(){
  const [me,setMe]=useState<any>(null);
  useEffect(()=>{
    fetch('/api/auth/me',{credentials:'include',cache:'no-store'})
      .then(r=>r.ok?r.json():null)
      .then(j=>setMe(j?.user||null))
      .catch(()=>{});
  },[]);
  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="hover:underline">Home</Link>
      {me?.emailVerified && <Link href="/book" className="hover:underline">Book</Link>}
      {me?.emailVerified && <Link href="/bookings" className="hover:underline">History</Link>}
      {me && <Link href="/profile" className="hover:underline">Profile</Link>}
      {me?.role === 'ADMIN' && <Link href="/admin" className="hover:underline">Admin</Link>}
    </nav>
  );
}

export function AuthButtons(){
  const [me,setMe]=useState<any>(null);
  useEffect(()=>{
    fetch('/api/auth/me',{credentials:'include',cache:'no-store'})
      .then(r=>r.ok?r.json():null)
      .then(j=>setMe(j?.user||null))
      .catch(()=>{});
  },[]);

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST',credentials:'include'});
    location.href='/';
  }

  if(!me){
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="px-3 py-1.5 rounded-xl border">Login</Link>
        <Link href="/register" className="px-3 py-1.5 rounded-xl border bg-black text-white">Register</Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={logout} className="px-3 py-1.5 rounded-xl border">Logout</button>
    </div>
  );
}
