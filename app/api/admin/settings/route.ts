import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function POST(req:Request){
  const u = await getUserFromCookie(); if(!u || u.role!=='ADMIN') return NextResponse.json({ok:false},{status:401});
  const j = await req.json();
  const s = await prisma.settings.findFirst();
  const data:any = {};
  for (const k of ['dayBase','dayPerKm','dayPerMin','nightBase','nightPerKm','nightPerMin']) if (k in j) data[k]=Number(j[k]);
  for (const k of ['workStart','workEnd']) if (k in j) data[k]=String(j[k]);
  if (!s) await prisma.settings.create({ data }); else await prisma.settings.update({ where:{ id:s.id }, data });
  return NextResponse.json({ ok:true });
}
