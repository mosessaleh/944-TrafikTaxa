import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

const Schema = z.object({});

export async function POST(req: Request){
  try{
    await req.json().catch(()=>({}));
    const me = await getUserFromCookie();
    if (!me) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });

    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user?.pendingEmail) return NextResponse.json({ ok:false, error:'No pending email' }, { status:400 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({ where: { id: me.id }, data: { pendingEmailCode: code, pendingEmailExpires: expires } });
    await sendEmail(user.pendingEmail, 'Verify your new email', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes.</p>`);

    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message || 'Invalid' }, { status:400 });
  }
}
