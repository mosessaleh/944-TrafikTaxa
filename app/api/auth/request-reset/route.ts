import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request){
  const { email } = Schema.parse(await req.json());
  const u = await prisma.user.findUnique({ where: { email } });
  if (u){
    const token = crypto.randomBytes(24).toString('hex');
    const exp = new Date(Date.now()+1000*60*30);
    await prisma.user.update({ where: { id: u.id }, data: { resetToken: token, resetExpires: exp } });
    const url = `${process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'}/reset?token=${token}`;
    await sendEmail(email, 'Password reset', `<p>Reset your password: <a href="${url}">Reset Link</a> (valid 30 min)</p>`);
  }
  return NextResponse.json({ ok:true });
}
