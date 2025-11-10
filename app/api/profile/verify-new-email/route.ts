import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';

const Schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request){
  try{
    await limitOrThrow('verify-new-email:'+clientIpKey(req), { points: 5, durationSec: 300 });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Too many attempts, try later.' }, { status: e?.status||429 });
  }
  try{
    const { email, code } = Schema.parse(await req.json());
    const user = await prisma.user.findFirst({ where: { pendingEmail: email } });
    if (!user || !user.pendingEmailCode || !user.pendingEmailExpires) return NextResponse.json({ ok:false, error:'If an account exists you will receive an email.' }, { status:200 });

    if (user.pendingEmailCode !== code) return NextResponse.json({ ok:false, error:'Invalid or expired code.' }, { status:400 });
    if (user.pendingEmailExpires < new Date()) return NextResponse.json({ ok:false, error:'Invalid or expired code.' }, { status:400 });

    await prisma.user.update({ where:{ id: user.id }, data:{ email: user.pendingEmail!, emailVerified: true, pendingEmail: null, pendingEmailCode: null, pendingEmailExpires: null } });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Invalid request' }, { status:400 });
  }
}
