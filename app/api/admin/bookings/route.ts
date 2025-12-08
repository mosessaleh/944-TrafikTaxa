import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(){
  console.log('GET /api/admin/bookings called - auth disabled for testing');
  // try{
  //   await requireAdmin();
  // }catch(e:any){
  //   return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 });
  // }
  try{
    console.log('Prisma instance:', !!prisma);
    console.log('Fetching rides...');
    const rides = await prisma.ride.findMany();
    console.log('Fetched rides:', Array.isArray(rides) ? rides.length : 'unknown');
    return NextResponse.json({ ok:true, rides });
  }catch(e:any){
    console.error('Error fetching rides:', e);
    console.error('Error stack:', e.stack);
    return NextResponse.json({ ok:false, error: e?.message || 'Database error' }, { status:500 });
  }
}
