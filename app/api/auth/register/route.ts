import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, setSessionCookie, signToken } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { validateRequestOrigin } from '@/lib/security-headers';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).regex(/^[^\u0600-\u06FF\s\-'\.]+$/u, "First name contains invalid characters"),
  lastName: z.string().min(1).regex(/^[^\u0600-\u06FF\s\-'\.]+$/u, "Last name contains invalid characters"),
  phone: z.string().min(6),
  address: z.string().min(1)
});

export async function POST(req: Request){
  try{
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok:false, error:'Invalid request origin' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      return NextResponse.json({ ok:false, error:'Validation failed', details: fieldErrors }, { status:400 });
    }
    const data = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return NextResponse.json({ ok:false, error:'If this email is registered, you will receive a verification code' }, { status:200 });

    const hashedPassword = await hashPassword(data.password);
    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now()+1000*60*60); // 1 hour expiry

    const { password, ...userData } = data;

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        address: userData.address,
        hashedPassword,
        emailVerifyCode: code,
        emailVerifyExpires: expires
      }
    });

    const mail = await sendEmail(data.email, 'Verify your email', `<p>Your verification code is <b>${code}</b>. It expires in 1 hour.</p>`);

    const token = signToken({ id: user.id, type: 'user', role: user.role });
    await setSessionCookie(token);
    const res = NextResponse.json({ ok:true, mail: mail.ok, next: `/verify?email=${encodeURIComponent(user.email)}` });

    return res;
  }catch(e:any){
    const errorMessage = process.env.NODE_ENV === 'production' ? 'Registration failed' : (e?.message || 'Invalid');
    return NextResponse.json({ ok:false, error: errorMessage }, { status:400 });
  }
}
