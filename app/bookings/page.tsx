import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import Alert from '@/components/alert';

export default async function BookingsPage(){
  const u = await getCurrentUser();
  if (!u) return <div>Unauthorized</div>;
  const verifyUrl = `/verify?email=${encodeURIComponent(u.email)}`;
  if (!u.emailVerified){
    return (
      <div className="max-w-2xl mx-auto grid gap-6">
        <h1 className="text-3xl font-bold">My Bookings</h1>
        <Alert title="Email verification required" message="Please verify your email to view your bookings history." action={<Link href={verifyUrl} className="px-4 py-2 rounded-xl border bg-black text-white">Go to verification</Link>} />
      </div>
    );
  }
  const rides = await prisma.ride.findMany({ where:{ userId:u.id }, orderBy:{ createdAt:'desc' } });
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-bold">My Bookings</h1>
      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left"><th className="p-3">#</th><th className="p-3">Pickup</th><th className="p-3">Dropoff</th><th className="p-3">Time</th><th className="p-3">Price</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {rides.map(r=> (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.id}</td>
                <td className="p-3">{r.pickupAddress}</td>
                <td className="p-3">{r.dropoffAddress}</td>
                <td className="p-3">{new Date(r.pickupTime).toLocaleString()}</td>
                <td className="p-3">{formatCurrency(Number(r.price))}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
