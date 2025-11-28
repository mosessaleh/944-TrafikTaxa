"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { getAdminPath } from '@/lib/admin-route';
import dkMessages from '@/messages/dk.json';
import enMessages from '@/messages/en.json';

export type NavUser = { id:number; firstName:string; lastName:string; email:string; role?: 'ADMIN'|'USER'; language?: string; type?: 'user' } | { id:number; comUserName:string; comName:string; type: 'partner' } | null;

// Translation messages
const messages = {
  dk: dkMessages,
  en: enMessages
};

export default function SiteNavbar({ me }: { me: NavUser }){
  const isAdmin = me?.type === 'user' && me?.role === 'ADMIN';
  const isPartner = me?.type === 'partner';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [language, setLanguage] = useState('dk');

  useEffect(() => {
    if (me?.type === 'user') {
      // Logged-in user: use database language, clear localStorage
      const userLang = (me as any).language || 'dk';
      setLanguage(userLang);
      localStorage.removeItem('language');
    } else if (me === null) {
      // User just logged out: store current language to localStorage
      localStorage.setItem('language', language);
    } else {
      // Guest: use localStorage or default
      const saved = localStorage.getItem('language') || 'dk';
      setLanguage(saved);
    }
  }, [me]);

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = messages[language as keyof typeof messages];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-slate-200/50 shadow-lg" suppressHydrationWarning>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between relative">
        {/* Mobile menu button - absolute positioned on mobile */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-lg hover:bg-slate-50 transition-colors z-10"
          aria-label="Toggle mobile menu"
          suppressHydrationWarning
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Center: logo on mobile, Left: logo + main links on desktop */}
        <div className="flex items-center gap-6 md:justify-start justify-center flex-1">
          <Link href="/" className="flex items-center gap-3 group" aria-label="944 Trafik home">
            <img src="/logo.svg" alt="944 Trafik" className="h-10 w-auto drop-shadow-sm group-hover:scale-105 transition-transform duration-300" />
          </Link>
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t('nav.home')}
            </Link>
            {!isPartner && (
              <Link
                href="/book"
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                {t('nav.book')}
              </Link>
            )}
            <Link
              href="/pricing"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t('nav.pricing')}
            </Link>
            <Link
              href="/terms"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t('nav.terms')}
            </Link>
            <Link
              href="/knowledge-base"
              className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              {t('nav.help')}
            </Link>
          </nav>
        </div>

        {/* Right: language switcher and auth actions */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const newLang = 'dk';
                if (me) {
                  localStorage.removeItem('language');
                  try {
                    // Get CSRF token
                    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
                    const csrfData = await csrfRes.json();
                    if (csrfData.success) {
                      await fetch('/api/profile/update', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-CSRF-Token': csrfData.token
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                          language: newLang
                        })
                      });
                    }
                  } catch (e) {
                    console.error('Failed to update language:', e);
                  }
                } else {
                  localStorage.setItem('language', newLang);
                }
                setLanguage(newLang);
                window.location.reload();
              }}
              className={`px-2 py-1 text-xs font-medium rounded ${language === 'dk' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              DK
            </button>
            <button
              onClick={async () => {
                const newLang = 'en';
                if (me) {
                  localStorage.removeItem('language');
                  try {
                    // Get CSRF token
                    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
                    const csrfData = await csrfRes.json();
                    if (csrfData.success) {
                      await fetch('/api/profile/update', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-CSRF-Token': csrfData.token
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                          language: newLang
                        })
                      });
                    }
                  } catch (e) {
                    console.error('Failed to update language:', e);
                  }
                } else {
                  localStorage.setItem('language', newLang);
                }
                setLanguage(newLang);
                window.location.reload();
              }}
              className={`px-2 py-1 text-xs font-medium rounded ${language === 'en' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
            >
              EN
            </button>
          </div>
          {!me && (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                {t('auth.login')}
              </Link>
              <Link href="/register" className="btn-primary shadow-md text-sm">
                {t('auth.register')}
              </Link>
            </>
          )}
          {me && (
            <div className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors" suppressHydrationWarning>
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold" suppressHydrationWarning>
                  {isPartner ? (me as any).comName.charAt(0).toUpperCase() : me.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700">
                    {isPartner ? (me as any).comName : `${me.firstName} ${me.lastName}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isPartner ? (me as any).comUserName : me.email}
                  </span>
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <Link href="/account?tab=profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('auth.profile')}</Link>
                  {isAdmin && <Link href={getAdminPath()} onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('admin.dashboard')}</Link>}
                  {isPartner && <Link href="/partner/dashboard" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{t('partner.dashboard')}</Link>}
                  <a href="/logout" onClick={() => { sessionStorage.setItem('logoutIntent', 'true'); setDropdownOpen(false); }} className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100" suppressHydrationWarning>{t('auth.logout')}</a>
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
              <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl mb-4" suppressHydrationWarning>
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold" suppressHydrationWarning>
                  {isPartner ? (me as any).comName.charAt(0).toUpperCase() : me.firstName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-medium text-slate-700">
                    {isPartner ? (me as any).comName : `${me.firstName} ${me.lastName}`}
                  </span>
                  <span className="text-xs text-slate-500">
                    {isPartner ? (me as any).comUserName : me.email}
                  </span>
                </div>
              </div>
            )}
            <Link
              href="/"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.home')}
            </Link>
            {!isPartner && (
              <Link
                href="/book"
                className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t('nav.book')}
              </Link>
            )}
            <Link
              href="/pricing"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.pricing')}
            </Link>
            <Link
              href="/terms"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.terms')}
            </Link>
            <Link
              href="/knowledge-base"
              className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('nav.help')}
            </Link>

            {/* Language Switcher Mobile */}
            <div className="border-t border-slate-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium text-slate-700">{t('ui.language')}:</span>
                <button
                  onClick={async () => {
                    const newLang = 'dk';
                    if (me) {
                      localStorage.removeItem('language');
                      try {
                        // Get CSRF token
                        const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
                        const csrfData = await csrfRes.json();
                        if (csrfData.success) {
                          await fetch('/api/profile/update', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfData.token
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                              language: newLang
                            })
                          });
                        }
                      } catch (e) {
                        console.error('Failed to update language:', e);
                      }
                    } else {
                      localStorage.setItem('language', newLang);
                    }
                    setLanguage(newLang);
                    window.location.reload();
                  }}
                  className={`px-3 py-1 text-sm font-medium rounded ${language === 'dk' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  DK
                </button>
                <button
                  onClick={async () => {
                    const newLang = 'en';
                    if (me) {
                      localStorage.removeItem('language');
                      try {
                        // Get CSRF token
                        const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
                        const csrfData = await csrfRes.json();
                        if (csrfData.success) {
                          await fetch('/api/profile/update', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'X-CSRF-Token': csrfData.token
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                              language: newLang
                            })
                          });
                        }
                      } catch (e) {
                        console.error('Failed to update language:', e);
                      }
                    } else {
                      localStorage.setItem('language', newLang);
                    }
                    setLanguage(newLang);
                    window.location.reload();
                  }}
                  className={`px-3 py-1 text-sm font-medium rounded ${language === 'en' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  EN
                </button>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4 mt-4">
              {!me ? (
                <div className="space-y-2">
                  <Link
                    href="/login"
                    className="block w-full btn-ghost text-center text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                    suppressHydrationWarning
                  >
                    {t('auth.login')}
                  </Link>
                  <Link
                    href="/register"
                    className="block w-full btn-primary text-center shadow-md text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                    suppressHydrationWarning
                  >
                    {t('auth.register')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/account?tab=profile"
                    className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium transition-colors text-sm"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t('auth.profile')}
                  </Link>
                  {isAdmin && (
                    <Link
                      href={getAdminPath()}
                      className="block px-4 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-sm hover:bg-black hover:shadow-md transition-colors text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  {isPartner && (
                    <Link
                      href="/partner/dashboard"
                      className="block px-4 py-3 rounded-lg bg-slate-900 text-white font-medium shadow-sm hover:bg-black hover:shadow-md transition-colors text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                  )}
                  <a
                    href="/logout"
                    className="block px-4 py-3 rounded-lg hover:bg-slate-50 text-red-600 hover:text-red-700 font-medium transition-colors text-sm"
                    onClick={() => { sessionStorage.setItem('logoutIntent', 'true'); setMobileMenuOpen(false); }}
                    suppressHydrationWarning
                  >
                    {t('auth.logout')}
                  </a>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
