import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword } from '@/lib/auth';

export async function POST(req: Request){
  try{
    const { email, password, token } = await req.json();
    if (!token || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    const user = await prisma.user.findFirst({ where:{ email } });
    if (!user) return NextResponse.json({ ok:false, error:'User not found' }, { status:404 });
    const match = await comparePassword(password, user.hashedPassword);
    return NextResponse.json({ ok:true, match });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'failed' }, { status:500 });
  }
}
