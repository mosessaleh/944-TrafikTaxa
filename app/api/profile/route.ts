import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { validateCSRFMiddleware } from '@/lib/csrf';
import { limitCSRFValidationFailures, clientIpKey } from '@/lib/rate-limit';

const Schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3),
  address: z.string().min(1)
});

export async function GET(){
  const me = await getUserFromCookie();
  if(!me) return NextResponse.json({ ok:false, me:null }, { status:200 });
  const safe = await prisma.user.findUnique({ where:{ id: me.id }, select:{ id:true, email:true, emailVerified:true, firstName:true, lastName:true, phone:true, address:true, role:true, canPayByInvoice:true } });
  return NextResponse.json({ ok:true, me: safe });
}

export async function PUT(req: Request){
  const me = await getUserFromCookie();
  if(!me) return NextResponse.json({ ok:false }, { status:401 });

  // CSRF protection for sensitive operations
  const isValidCSRF = await validateCSRFMiddleware(req, me.id);
  if (!isValidCSRF) {
    // Rate limiting for CSRF validation failures
    const clientKey = clientIpKey(req);
    try {
      await limitCSRFValidationFailures(clientKey);
    } catch (rateLimitError: any) {
      return NextResponse.json(
        { error: 'Too many failed requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': rateLimitError.retryAfter?.toString() || '900' } }
      );
    }

    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const data = Schema.parse(await req.json());
  const emailChanged = data.email.toLowerCase() !== (me as any).email.toLowerCase();
  const update:any = { firstName:data.firstName, lastName:data.lastName, phone:data.phone, address:data.address };
  if(emailChanged){ update.pendingEmail = data.email; update.pendingEmailCode = String(Math.floor(100000+Math.random()*900000)); update.pendingEmailExpires = new Date(Date.now()+1000*60*30); }
  await prisma.user.update({ where:{ id: me.id }, data: update });
  return NextResponse.json({ ok:true, pendingEmail: emailChanged? data.email: null });
}
