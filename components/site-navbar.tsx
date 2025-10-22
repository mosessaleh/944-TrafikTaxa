"use client";
import Link from 'next/link';

export type NavUser = { id:number; firstName:string; lastName:string; role?: 'ADMIN'|'USER' } | null;

export default function SiteNavbar({ me }: { me: NavUser }){
  const isAdmin = me?.role === 'ADMIN';
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b mb-[10px] p-[5px]">
      <div className="mx-auto max-w-6xl px-4 py-1 flex items-center justify-between">
        {/* Left: logo + main links */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <img src="/logo.svg" alt="944 Trafik" className="h-10 w-auto" />
            {/* تمت إزالة اسم الموقع بجانب الشعار */}
          </Link>
          <nav className="hidden md:flex items-center gap-3 text-sm">
            <Link href="/" className="px-3 py-1 rounded hover:bg-gray-100">Home</Link>
            <Link href="/book" className="px-3 py-1 rounded hover:bg-gray-100">Book</Link>
            {me && <Link href="/account" className="px-3 py-1 rounded hover:bg-gray-100">Account</Link>}
            {isAdmin && <Link href="/admin" className="px-3 py-1 rounded hover:bg-gray-100">Admin</Link>}
          </nav>
        </div>

        {/* Right: auth actions */}
        <div className="flex items-center gap-2">
          {!me && (
            <>
              <Link href="/login" className="px-3 py-1 rounded-xl border">Login</Link>
              <Link href="/register" className="px-3 py-1 rounded-xl bg-black text-white">Register</Link>
            </>
          )}
          {me && (
            <>
              <span className="hidden sm:inline text-sm text-gray-700 mr-1">Hi, {me.firstName}</span>
              <form action="/api/auth/logout" method="post">
                <button className="px-3 py-1 rounded-xl border" type="submit">Logout</button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
