import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).regex(/^[a-zA-ZæøåÆØÅ\s\-'\.]+$/u, "First name contains invalid characters"),
  lastName: z.string().min(1).regex(/^[a-zA-ZæøåÆØÅ\s\-'\.]+$/u, "Last name contains invalid characters"),
  phone: z.string().min(6),
  street: z.string().min(2).regex(/^[a-zA-ZæøåÆØÅ0-9\s,.\-#&()\/]+$/u, "Street contains invalid characters"),
  houseNumber: z.string().min(1),
  postalCode: z.string().min(2),
  city: z.string().min(2).regex(/^[a-zA-ZæøåÆØÅ\s\-.,'&()]+$/u, "City contains invalid characters")
});

export async function POST(req: Request){
  try{
    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok:false, error:'Validation failed', details: fieldErrors }, { status:400 });
    }
    const data = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return NextResponse.json({ ok:false, error:'Email already registered' }, { status:409 });

    const hashedPassword = await hashPassword(data.password);
    const code = Math.floor(100000 + Math.random()*900000).toString();
    const expires = new Date(Date.now()+1000*60*15);

    const { password, ...rest } = data;

    const user = await prisma.user.create({
      data: { ...rest, hashedPassword, emailVerifyCode: code, emailVerifyExpires: expires }
    });

    const mail = await sendEmail(data.email, 'Verify your email', `<p>Your verification code is <b>${code}</b>. It expires in 15 minutes.</p>`);

    const token = signToken({ id: user.id, role: user.role });
    const res = NextResponse.json({ ok:true, mail: mail.ok, next: `/verify?email=${encodeURIComponent(user.email)}` });
    const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
    res.cookies.set('session', token, { httpOnly:true, secure, sameSite:'lax', path:'/', maxAge:60*60*24*7 });
    return res;
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||'Invalid' }, { status:400 });
  }
}
