import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(){
  const u = await getUserFromCookie();
  if (!u || u.role !== 'ADMIN') return NextResponse.json({ ok:false }, { status:401 });
  const rides = await prisma.ride.findMany({ where:{ status:'PENDING' }, orderBy:{ pickupTime:'asc' } });
  return NextResponse.json({ ok:true, rides });
}
