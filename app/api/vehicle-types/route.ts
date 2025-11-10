import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(){
  const items = await prisma.vehicleType.findMany({ where:{ active:true }, orderBy:{ id:'asc' }, select:{ id:true, key:true, title:true, capacity:true, multiplier:true } });
  return NextResponse.json({ ok:true, items });
}
