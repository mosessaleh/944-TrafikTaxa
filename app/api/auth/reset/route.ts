import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const Schema = z.object({ token: z.string().min(10), password: z.string().min(8) });

export async function POST(req: Request){
  const { token, password } = Schema.parse(await req.json());
  const u = await prisma.user.findFirst({ where: { resetToken: token } });
  if (!u || !u.resetExpires || u.resetExpires < new Date()) return NextResponse.json({ ok:false, error:'Invalid or expired token' }, { status:400 });
  const hashed = await hashPassword(password);
  await prisma.user.update({ where: { id: u.id }, data: { hashedPassword: hashed, resetToken: null, resetExpires: null } });
  return NextResponse.json({ ok:true });
}
