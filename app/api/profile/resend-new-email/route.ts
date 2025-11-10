import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';

export async function POST(req: Request){
  try{
    await limitOrThrow('resend-new-email:'+clientIpKey(req), { points: 3, durationSec: 300 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Too many attempts, try later.' }, { status: e?.status||429 });
  }
  try{
    await req.json().catch(()=>({}));
    const me = await getUserFromCookie();
    if (!me) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });

    const user = await prisma.user.findUnique({ where: { id: me.id } });
    if (!user?.pendingEmail) return NextResponse.json({ ok:false, error:'If an account exists you will receive an email.' }, { status:200 });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({ where: { id: me.id }, data: { pendingEmailCode: code, pendingEmailExpires: expires } });
    await sendEmail(user.pendingEmail, 'Verify your new email', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes.</p>`);
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 });
  }
}
