import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { ensureDevelopmentOnly } from '@/lib/dev-route';

const Schema = z.object({ to: z.string().email() });

export async function POST(req: Request){
  const blocked = ensureDevelopmentOnly();
  if (blocked) return blocked;

  try{
    const { to } = Schema.parse(await req.json());
    const r = await sendEmail(to, '944 Trafik — Test email', '<p>This is a test email from 944 Trafik.</p>');
    if(!r.ok) return NextResponse.json({ ok:false, error:r.reason }, { status:400 });
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||'Invalid' }, { status:400 });
  }
}
