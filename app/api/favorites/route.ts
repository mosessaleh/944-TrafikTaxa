import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

const Add = z.object({ label: z.string().min(1), address: z.string().min(3), lat: z.number().nullable().optional(), lon: z.number().nullable().optional() });

export async function GET(){
  const me = await getUserFromCookie();
  if (!me) return NextResponse.json({ ok:false }, { status:401 });
  const items = await prisma.favoriteAddress.findMany({ where:{ userId: me.id }, orderBy:{ createdAt:'desc' }, take: 20 });
  return NextResponse.json({ ok:true, items });
}

export async function POST(req: Request){
  const me = await getUserFromCookie();
  if (!me) return NextResponse.json({ ok:false }, { status:401 });
  const data = Add.parse(await req.json());
  const item = await prisma.favoriteAddress.create({ data: { userId: me.id, label: data.label, address: data.address, lat: data.lat||null, lon: data.lon||null } });
  return NextResponse.json({ ok:true, item });
}

export async function DELETE(req: Request){
  const me = await getUserFromCookie();
  if (!me) return NextResponse.json({ ok:false }, { status:401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ ok:false }, { status:400 });
  await prisma.favoriteAddress.delete({ where:{ id, userId: me.id } as any });
  return NextResponse.json({ ok:true });
}
