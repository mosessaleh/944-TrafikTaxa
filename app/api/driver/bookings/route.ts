import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriver } from '@/lib/auth';

export async function GET(req: NextRequest){
  try{ await requireDriver(); }catch(e:any){ return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 }); }

  try{
    // For now, return all rides with status DISPATCHED, ONGOING (assuming driver can see assigned rides)
    // In real implementation, filter by driver assignment
    const rides = await prisma.ride.findMany({
      where: {
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