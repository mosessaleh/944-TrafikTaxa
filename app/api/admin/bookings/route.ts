import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(){
  try{
    await requireAdmin();
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 });
  }

  try{
    const rides = await prisma.ride.findMany();
    return NextResponse.json({ ok:true, rides });
  }catch(e:any){
    console.error('Error fetching rides:', e);
    return NextResponse.json({ ok:false, error: 'Database error' }, { status:500 });
  }
}
