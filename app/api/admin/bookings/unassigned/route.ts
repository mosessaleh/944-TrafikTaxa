import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(){
  const u = await getUserFromCookie();
  if (!u || u.type !== 'user' || (u as any).role !== 'ADMIN') return NextResponse.json({ ok:false }, { status:401 });
  const rides = await prisma.ride.findMany({
    where:{
      status: 'PENDING',
      driverId: null
    },
    orderBy:{ pickupTime:'asc' },
    include: {
      vehicleType: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          phone: true
        }
      }
    }
  });
  return NextResponse.json({ ok:true, rides });
}