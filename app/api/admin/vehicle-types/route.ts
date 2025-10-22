import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const Upsert = z.object({ id: z.number().int().optional(), key: z.enum(['SEDAN5','SEVEN_NO_BAG','VAN','LIMO']), title: z.string().min(2), capacity: z.number().int().min(1).max(16), multiplier: z.number().positive(), active: z.boolean() });

export async function GET(){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false }, { status:403 }); }
  const items = await prisma.vehicleType.findMany({ orderBy:{ id:'asc' } });
  return NextResponse.json({ ok:true, items });
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false }, { status:403 }); }
  const body = await req.json();
  const data = Upsert.parse(body);
  const item = await prisma.vehicleType.upsert({
    where: { id: data.id || 0 },
    update: { key: data.key, title: data.title, capacity: data.capacity, multiplier: data.multiplier, active: data.active },
    create: { key: data.key, title: data.title, capacity: data.capacity, multiplier: data.multiplier, active: data.active }
  });
  return NextResponse.json({ ok:true, item });
}
