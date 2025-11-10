import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request){
  try{
    const { email, code } = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok:false, error:'Account not found' }, { status:404 });

    if (user.emailVerified) {
      return NextResponse.json({ ok:true, already:true });
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpires) {
      return NextResponse.json({ ok:false, error:'No verification code issued. Please resend a new code.' }, { status:400 });
    }

    if (user.emailVerifyCode !== code) {
      return NextResponse.json({ ok:false, error:'Invalid verification code' }, { status:400 });
    }

    if (user.emailVerifyExpires < new Date()) {
      return NextResponse.json({ ok:false, error:'Code expired. Please request a new code.' }, { status:400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyCode: null, emailVerifyExpires: null }
    });

    await sendEmail(user.email, 'Welcome to 944 Trafik', `<p>Welcome, ${user.firstName}! Your account is verified.</p>`);

    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||'Invalid request' }, { status:400 });
  }
}
