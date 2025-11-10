import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(){
  try{
    await requireAdmin();
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Forbidden' }, { status: e?.status||403 });
  }
  const rides = await prisma.ride.findMany({ orderBy:{ createdAt:'desc' }, include:{ user:true } });
  return NextResponse.json({ ok:true, rides });
}
