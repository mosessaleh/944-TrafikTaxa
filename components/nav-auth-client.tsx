"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAdminPath } from '@/lib/admin-route';
import { isStaffRole } from '@/lib/permissions';

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
    </nav>
  );
}

export function AuthButtons(){
  const [me,setMe]=useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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
    <div className="relative">
      <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer">
        {(me.firstName || me.email).charAt(0).toUpperCase()}
      </button>
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <Link href="/profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</Link>
          {isStaffRole(me.role) && <Link href={getAdminPath()} onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Dashboard</Link>}
          <button onClick={() => { logout(); setDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Logout</button>
        </div>
      )}
    </div>
  );
}
