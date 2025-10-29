import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

const Upsert = z.object({
  id: z.number().int().optional(),
  key: z.string().min(1).max(20).regex(/^[A-Z0-9_]+$/),
  title: z.string().min(2),
  capacity: z.number().int().min(1).max(16),
  multiplier: z.number().positive(),
  active: z.boolean()
});

export async function GET(){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false }, { status:403 }); }
  const items = await prisma.vehicleType.findMany({ orderBy:{ id:'asc' } });
  return NextResponse.json({ ok:true, items });
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false }, { status:403 }); }
  const body = await req.json();
  const data = Upsert.parse(body);

  if (data.id) {
    // Update existing
    const item = await prisma.vehicleType.update({
      where: { id: data.id },
      data: { key: data.key, title: data.title, capacity: data.capacity, multiplier: data.multiplier, active: data.active }
    });
    return NextResponse.json({ ok:true, item });
  } else {
    // Create new
    const item = await prisma.vehicleType.create({
      data: { key: data.key, title: data.title, capacity: data.capacity, multiplier: data.multiplier, active: data.active }
    });
    return NextResponse.json({ ok:true, item });
  }
}

export async function DELETE(req: Request){
  try{ await requireAdmin(); }catch(e:any){ return NextResponse.json({ ok:false }, { status:403 }); }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ ok:false, error:'Missing id' }, { status:400 });

  await prisma.vehicleType.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok:true });
}
