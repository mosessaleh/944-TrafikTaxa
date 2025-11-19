import Link from 'next/link';
import { getUserFromCookie } from '@/lib/auth';
import { getAdminPath } from '@/lib/admin-route';

export default async function AdminLayout({ children }:{ children: React.ReactNode }){
  const me = await getUserFromCookie();
  const isAdmin = !!me && me.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-950/[0.02] pt-10 pb-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {isAdmin && (
          <aside className="mb-6">
            <nav className="flex gap-2 overflow-x-auto rounded-2xl bg-white/80 backdrop-blur border border-slate-200 p-2 shadow-sm">
              <Link
                href={getAdminPath()}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-transparent bg-slate-900 text-white shadow-sm hover:bg-slate-800 whitespace-nowrap"
              >
                <span>📊</span>
                <span>Dashboard</span>
              </Link>
              <Link
                href={getAdminPath('/bookings')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>📋</span>
                <span>Bookings</span>
              </Link>
              <Link
                href={getAdminPath('/users')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>👥</span>
                <span>Users</span>
              </Link>
              <Link
                href={getAdminPath('/vehicles')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>🚗</span>
                <span>Vehicles</span>
              </Link>
              <Link
                href={getAdminPath('/payments')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>💳</span>
                <span>Payments</span>
              </Link>
              <Link
                href={getAdminPath('/settings')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>⚙️</span>
                <span>Settings</span>
              </Link>
              <Link
                href={getAdminPath('/crypto')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>₿</span>
                <span>Crypto</span>
              </Link>
              <Link
                href={getAdminPath('/complaints')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 whitespace-nowrap"
              >
                <span>⚠️</span>
                <span>Complaints</span>
              </Link>
              <Link
                href={getAdminPath('/clear-data')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 whitespace-nowrap"
              >
                <span>🧹</span>
                <span>Clear Data</span>
              </Link>
            </nav>
          </aside>
        )}

        <div className="grid gap-6">
          {children}
        </div>
      </div>
    </div>
  );
}
