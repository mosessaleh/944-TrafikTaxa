import Link from 'next/link';
import { getUserFromCookie } from '@/lib/auth';
import { getAdminPath } from '@/lib/admin-route';

export default async function AdminLayout({ children }:{ children: React.ReactNode }){
  const me = await getUserFromCookie();
  // Show tabs only if the user is an admin — otherwise each page will render its own access restriction
  const isAdmin = !!me && me.role === 'ADMIN';
  return (
    <div className="grid gap-6">
      {isAdmin && (
        <div className="flex gap-2 flex-wrap">
          <Link href={getAdminPath()} className="px-3 py-1.5 rounded-xl border">Dashboard</Link>
          <Link href={getAdminPath('/bookings')} className="px-3 py-1.5 rounded-xl border">Bookings</Link>
          <Link href={getAdminPath('/users')} className="px-3 py-1.5 rounded-xl border">Users</Link>
          <Link href={getAdminPath('/vehicles')} className="px-3 py-1.5 rounded-xl border">Vehicles</Link>
          <Link href={getAdminPath('/payments')} className="px-3 py-1.5 rounded-xl border">Payments</Link>
          <Link href={getAdminPath('/settings')} className="px-3 py-1.5 rounded-xl border">Settings</Link>
          <Link href={getAdminPath('/crypto')} className="px-3 py-1.5 rounded-xl border">Crypto</Link>
          <Link href={getAdminPath('/complaints')} className="px-3 py-1.5 rounded-xl border">Complaints</Link>
          <Link href={getAdminPath('/clear-data')} className="px-3 py-1.5 rounded-xl border bg-red-50 text-red-700 hover:bg-red-100">🧹 Clear Data</Link>
        </div>
      )}
      {children}
    </div>
  );
}
