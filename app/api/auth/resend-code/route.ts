import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request){
  try{
    const { email } = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok:true }); // لا نفصح
    if (user.emailVerified) return NextResponse.json({ ok:true, already:true });

    const code = Math.floor(100000 + Math.random()*900000).toString();
    const expires = new Date(Date.now()+1000*60*15);

    await prisma.user.update({ where:{ id:user.id }, data:{ emailVerifyCode: code, emailVerifyExpires: expires } });
    await sendEmail(email, 'Your verification code', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes.</p>`);

    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||'Invalid request' }, { status:400 });
  }
}
