import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ id: z.number().int(), dispatchNow: z.boolean() });

export async function POST(req: Request){
  const u = await getUserFromCookie();
  if (!u || u.type !== 'user' || (u as any).role !== 'ADMIN') return NextResponse.json({ ok:false }, { status:401 });
  const { id, dispatchNow } = Schema.parse(await req.json());
  const ride = await prisma.ride.update({ where:{ id }, data: { status: dispatchNow? 'DISPATCHED':'CONFIRMED' } , include: { user:true } });
  const msg = dispatchNow ? 'Your car is on the way.' : 'Your booking is confirmed and a car will arrive at the scheduled time.';
  await sendEmail(ride.user.email, 'Booking update', `<p>${msg}</p>`);

  // If confirmed (not dispatched), trigger automatic ride assignment
  if (!dispatchNow) {
    try {
      // Call the assign-rides API to assign drivers to confirmed rides
      const assignResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/assign-rides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Pass admin auth - in production this should use proper authentication
          'Cookie': req.headers.get('cookie') || ''
        }
      });

      if (assignResponse.ok) {
        console.log(`Ride assignment triggered for confirmed booking ${id}`);
      } else {
        console.error(`Failed to trigger ride assignment for booking ${id}`);
      }
    } catch (error) {
      console.error('Error triggering ride assignment:', error);
    }
  }

  return NextResponse.json({ ok:true });
}
