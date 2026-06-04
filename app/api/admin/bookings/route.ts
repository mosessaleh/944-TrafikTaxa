import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(){
  try{
    await requirePermission('bookings.read');
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 });
  }

  try{
    const rides = await prisma.ride.findMany({
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        vehicleType: {
          select: {
            title: true,
            key: true
          }
        }
      },
      orderBy: { pickupTime: 'desc' },
      take: 500
    });
    return NextResponse.json({ ok:true, rides });
  }catch(e:any){
    console.error('Error fetching rides:', e);
    return NextResponse.json({ ok:false, error: 'Database error' }, { status:500 });
  }
}
