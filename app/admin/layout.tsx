import Link from 'next/link';
import { getUserFromCookie } from '@/lib/auth';

export default async function AdminLayout({ children }:{ children: React.ReactNode }){
  const me = await getUserFromCookie();
  // إظهار التبويبات فقط لو المستخدم أدمن — وإلا سيشاهد رسالة الحظر من الصفحة نفسها
  const isAdmin = !!me && me.role === 'ADMIN';
  return (
    <div className="grid gap-6">
      {isAdmin && (
        <div className="flex gap-2">
          <Link href="/admin" className="px-3 py-1.5 rounded-xl border">Dashboard</Link>
           <Link href="/admin/bookings" className="px-3 py-1.5 rounded-xl border">Bookings</Link>
           <Link href="/admin/users" className="px-3 py-1.5 rounded-xl border">Users</Link>
           <Link href="/admin/vehicles" className="px-3 py-1.5 rounded-xl border">Vehicles</Link>
           <Link href="/admin/settings" className="px-3 py-1.5 rounded-xl border">Settings</Link>
           <Link href="/admin/crypto" className="px-3 py-1.5 rounded-xl border">Crypto</Link>
        </div>
      )}
      {children}
    </div>
  );
}
