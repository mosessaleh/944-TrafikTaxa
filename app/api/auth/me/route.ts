import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export async function GET(){
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  return NextResponse.json({ ok:true, user: u });
}
