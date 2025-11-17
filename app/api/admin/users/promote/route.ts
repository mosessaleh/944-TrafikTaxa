import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const Schema = z.object({ email: z.string().email(), role: z.enum(['ADMIN','USER']) });

export async function POST(req: Request){
  // حماية من CSRF عبر التحقق من Origin/Referer في الإنتاج
  const originCheck = validateRequestOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok:false, error:'Invalid request origin' },
      { status:403 }
    );
  }

  // تحقق أدمن باستخدام جلسة JWT الموقعة والمخزنة في الكوكي
  const me = await getUserFromCookie();
  if (!me) {
    return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });
  }
  if (me.role !== 'ADMIN') {
    return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
  }

  const { email, role } = Schema.parse(await req.json());
  await prisma.user.update({ where: { email }, data: { role } });
  return NextResponse.json({ ok:true });
}
