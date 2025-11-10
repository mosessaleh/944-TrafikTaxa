import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(){
  const settings = await prisma.settings.findFirst();
  if (!settings) return NextResponse.json({ ok:false, error:'Settings not found' }, { status:404 });
  return NextResponse.json({ ok:true, settings });
}