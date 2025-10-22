import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request){
  try{
    const { email, password, token } = await req.json();
    if (!token || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    if (!email || !password) return NextResponse.json({ ok:false, error:'email and password required' }, { status:400 });
    const user = await prisma.user.findFirst({ where:{ email } });
    if (!user) return NextResponse.json({ ok:false, error:'User not found' }, { status:404 });
    const hashed = await hashPassword(password);
    await prisma.user.update({ where:{ id:user.id }, data:{ hashedPassword: hashed } });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'failed' }, { status:500 });
  }
}
