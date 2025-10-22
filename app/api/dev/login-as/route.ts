import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';

export async function POST(req: Request){
  try{
    const { email, token } = await req.json();
    if (!token || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    const user = await prisma.user.findFirst({ where:{ email } });
    if (!user) return NextResponse.json({ ok:false, error:'User not found' }, { status:404 });
    const jwt = signToken({ id: user.id });
    setSessionCookie(jwt);
    return NextResponse.json({ ok:true, user: { id:user.id, email:user.email, role:user.role, emailVerified:user.emailVerified } });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'failed' }, { status:500 });
  }
}
