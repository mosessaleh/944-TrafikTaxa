import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const Schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request){
  try{
    const { email, code } = Schema.parse(await req.json());
    const user = await prisma.user.findFirst({ where: { pendingEmail: email } });
    if (!user) return NextResponse.json({ ok:false, error:'No pending change for this email' }, { status:404 });

    if (!user.pendingEmailCode || !user.pendingEmailExpires)
      return NextResponse.json({ ok:false, error:'No code issued' }, { status:400 });

    if (user.pendingEmailCode !== code)
      return NextResponse.json({ ok:false, error:'Invalid code' }, { status:400 });

    if (user.pendingEmailExpires < new Date())
      return NextResponse.json({ ok:false, error:'Code expired' }, { status:400 });

    // Apply change
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail!,
        emailVerified: true,
        pendingEmail: null,
        pendingEmailCode: null,
        pendingEmailExpires: null
      }
    });

    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message || 'Invalid' }, { status:400 });
  }
}
