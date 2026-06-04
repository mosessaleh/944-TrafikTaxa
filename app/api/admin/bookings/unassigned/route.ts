import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(){
  try{ await requirePermission('dispatch.manage'); }catch(e:any){ return NextResponse.json({ ok:false }, { status:e?.status||403 }); }
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
