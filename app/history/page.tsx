import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import HistoryClient from '@/components/history-client';
import Link from 'next/link';

export default async function HistoryPage(){
  const me = await getCurrentUser();
  if(!me){
    return (
      <div className="max-w-xl mx-auto grid gap-4">
        <h1 className="text-2xl font-bold">Trips history</h1>
        <div className="p-4 rounded-2xl border bg-yellow-50 text-yellow-900">
          You must be logged in to view your history. <Link href="/login" className="underline font-medium">Login</Link>
        </div>
      </div>
    )
  }
  const rides = await prisma.ride.findMany({ where:{ userId: me.id }, orderBy:{ pickupTime:'desc' } });
  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Your trips</h1>
        <Link href="/book" className="px-4 py-2 rounded-2xl bg-black text-white">Book a ride</Link>
      </div>
      <HistoryClient initialRides={rides} />
    </div>
  )
}
