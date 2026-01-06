import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';

export async function GET(req: NextRequest){
  let driver;
  try{ driver = await requireDriverByJWT(req); }catch(e:any){ return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 }); }

  try{
    // Return rides assigned to this driver with status DISPATCHED, ONGOING
    const rides = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['DISPATCHED', 'ONGOING'] }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: {
        pickupTime: 'asc'
      }
    });

    return NextResponse.json({ ok:true, rides });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Invalid' },{ status:400 });
  }
}