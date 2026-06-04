import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(){
  try{ await requirePermission('bookings.read'); }catch(e:any){ return NextResponse.json({ ok:false }, { status:e?.status||403 }); }
  const rides = await prisma.ride.findMany({ where:{ status:'PENDING' }, orderBy:{ pickupTime:'asc' } });
  return NextResponse.json({ ok:true, rides });
}
