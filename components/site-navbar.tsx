"use client";
import Link from "next/link";
import { useState } from "react";
import { getAdminPath } from '@/lib/admin-route';

export type NavUser = { id:number; firstName:string; lastName:string; role?: 'ADMIN'|'USER' } | null;

export default function SiteNavbar({ me }: { me: NavUser }){
  const isAdmin = me?.role === 'ADMIN';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            {me && (
              <Link
                href="/history"
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                My trips
              </Link>
            )}
            {isAdmin && (
              <Link
                href={getAdminPath()}
                className="ml-1 px-3.5 py-2 rounded-lg bg-slate-900 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-black hover:shadow-md transition-colors"
              >
                Admin panel
              </Link>
            )}
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
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                  {me.firstName.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">Hi, {me.firstName}</span>
              </div>
              <form action="/api/auth/logout" method="post">
                <button className="btn-ghost" type="submit">🚪 Logout</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200/50 shadow-lg">
          <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 space-y-2">
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
            {me && (
              <Link
                href="/history"
                className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                My trips
              </Link>
            )}
            {isAdmin && (
              <Link
                href={getAdminPath()}
                className="block px-4 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-sm hover:bg-black hover:shadow-md transition-colors text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin panel
              </Link>
            )}

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
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                      {me.firstName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700">Hi, {me.firstName}</span>
                  </div>
                  <form action="/api/auth/logout" method="post">
                    <button
                      className="w-full btn-ghost text-center text-sm"
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
