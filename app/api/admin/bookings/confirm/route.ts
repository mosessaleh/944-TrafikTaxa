import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ id: z.number().int(), dispatchNow: z.boolean() });

export async function POST(req: Request){
  const u = await getUserFromCookie();
  if (!u || u.role !== 'ADMIN') return NextResponse.json({ ok:false }, { status:401 });
  const { id, dispatchNow } = Schema.parse(await req.json());
  const ride = await prisma.ride.update({ where:{ id }, data: { status: dispatchNow? 'DISPATCHED':'CONFIRMED' } , include: { user:true } });
  const msg = dispatchNow ? 'Your car is on the way.' : 'Your booking is confirmed and a car will arrive at the scheduled time.';
  await sendEmail(ride.user.email, 'Booking update', `<p>${msg}</p>`);
  return NextResponse.json({ ok:true });
}
