import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import Link from 'next/link';

export default async function AdminHome(){
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN'){
    return (
      <div className="max-w-xl mx-auto grid gap-4">
        <h1 className="text-3xl font-bold">Admin</h1>
        <div className="border rounded-2xl p-4 bg-yellow-50 text-yellow-900">
          <div className="font-semibold">Access restricted</div>
          <div className="text-sm mt-1">You must be an administrator to view this page.</div>
          <div className="mt-3"><Link href="/" className="underline">Go back home</Link></div>
        </div>
      </div>
    );
  }

  const [pending, confirmed, ongoing, completed, unpaid] = await Promise.all([
    prisma.ride.count({ where:{ status:'PENDING' } }),
    prisma.ride.count({ where:{ status:'CONFIRMED' } }),
    prisma.ride.count({ where:{ status:'ONGOING' } }),
    prisma.ride.count({ where:{ status:'COMPLETED' } }),
    prisma.ride.count({ where:{ paid:false, OR:[{status:'COMPLETED'},{status:'DISPATCHED'},{status:'ONGOING'}] } })
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <div className="flex flex-wrap gap-3">
        {[{k:'Pending',v:pending},{k:'Confirmed',v:confirmed},{k:'Ongoing',v:ongoing},{k:'Completed',v:completed},{k:'Unpaid',v:unpaid}].map((c)=>(
          <div key={c.k} className="rounded-2xl border bg-white p-4 min-w-[160px]">
            <div className="text-sm text-gray-500">{c.k}</div>
            <div className="text-2xl font-bold">{c.v}</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-600">Use the tabs above to manage <a className="underline" href="/admin/bookings">Bookings</a>, <a className="underline" href="/admin/users">Users</a>, and <a className="underline" href="/admin/settings">Settings</a>.</div>
    </div>
  );
}
