import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/crypto';

export async function GET(){
  try{
    // DB ping
    await prisma.$queryRaw`SELECT 1`;
    // crypto test
    const h = await hashPassword('test1234');
    const ok = await comparePassword('test1234', h);
    return NextResponse.json({ ok:true, db:true, crypto: ok });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'Health failed' }, { status:500 });
  }
}
