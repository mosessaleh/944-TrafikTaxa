import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const SECRET = process.env.SECRET || 'dev_secret_change_me';
const Schema = z.object({ email: z.string().email(), role: z.enum(['ADMIN','USER']) });

export async function POST(req: Request){
  // تحقق أدمن بسيط عبر الكوكي
  const token = cookies().get('session')?.value;
  if (!token) return NextResponse.json({ ok:false }, { status:401 });
  try{
    const dec:any = verify(token, SECRET);
    if (dec.role !== 'ADMIN') return NextResponse.json({ ok:false }, { status:403 });
  }catch{ return NextResponse.json({ ok:false }, { status:401 }); }

  const { email, role } = Schema.parse(await req.json());
  await prisma.user.update({ where: { email }, data: { role } });
  return NextResponse.json({ ok:true });
}
