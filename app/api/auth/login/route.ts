import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';

const Schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: Request){
  const { email, password } = Schema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok:false, error:'Invalid credentials' }, { status:401 });
  const ok = await comparePassword(password, user.hashedPassword);
  if (!ok) return NextResponse.json({ ok:false, error:'Invalid credentials' }, { status:401 });
  const token = signToken({ id: user.id, role: user.role });
  const res = NextResponse.json({ ok:true, role: user.role, next: '/' });
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  res.cookies.set('session', token, { httpOnly:true, secure, sameSite:'lax', path:'/', maxAge:60*60*24*7 });
  return res;
}
