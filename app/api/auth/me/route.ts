import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(){
  const u = await getUserFromCookie();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  return NextResponse.json({ ok:true, user: u });
}
