"use client";
import Link from "next/link";
import { useState } from "react";
import { getAdminPath } from '@/lib/admin-route';

export type NavUser = { id:number; firstName:string; lastName:string; email:string; role?: 'ADMIN'|'USER' } | null;

export default function SiteNavbar({ me }: { me: NavUser }){
  const isAdmin = me?.role === 'ADMIN';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-200/50 shadow-lg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Left: logo + main links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group" aria-label="944 Trafik home">
            <img src="/logo.svg" alt="944 Trafik" className="h-10 w-auto drop-shadow-sm group-hover:scale-105 transition-transform duration-300" />
          </Link>
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Home
            </Link>
            <Link
              href="/book"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Book ride
            </Link>
            <Link
              href="/pricing"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              Terms & rules
            </Link>
          </nav>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-50 transition-colors"
          aria-label="Toggle mobile menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Right: auth actions */}
        <div className="hidden md:flex items-center gap-3">
          {!me && (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                Log in
              </Link>
              <Link href="/register" className="btn-primary shadow-md text-sm">
                Create account
              </Link>
            </>
          )}
          {me && (
            <div className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {me.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700">{me.firstName} {me.lastName}</span>
                  <span className="text-xs text-slate-500">{me.email}</span>
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <Link href="/account?tab=profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</Link>
                  {isAdmin && <Link href={getAdminPath()} onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Dashboard</Link>}
                  <form action="/api/auth/logout" method="post" onSubmit={() => setDropdownOpen(false)}>
                    <button type="submit" className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Logout</button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200/50 shadow-lg">
          <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 space-y-2">
            {me && (
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {me.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700">{me.firstName} {me.lastName}</span>
                  <span className="text-xs text-slate-500">{me.email}</span>
                </div>
              </div>
            )}
            <Link
              href="/"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/book"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Book ride
            </Link>
            <Link
              href="/pricing"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              Terms & rules
            </Link>

            <div className="border-t border-slate-200 pt-4 mt-4">
              {!me ? (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="block w-full btn-ghost text-center text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full btn-primary text-center shadow-md text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Create account
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/account?tab=profile"
                    className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  {isAdmin && (
                    <Link
                      href={getAdminPath()}
                      className="block px-4 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-sm hover:bg-black hover:shadow-md transition-colors text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  )}
                  <form action="/api/auth/logout" method="post">
                    <button
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-slate-50 text-red-600 hover:text-red-700 font-medium transition-colors text-sm"
                      type="submit"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Logout
                    </button>
                  </form>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
