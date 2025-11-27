import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { validateRequestOrigin } from '@/lib/security-headers';
import { validateCSRFMiddleware } from '@/lib/csrf';
import { limitCSRFValidationFailures, clientIpKey } from '@/lib/rate-limit';

const Schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(6),
  address: z.string().min(1),
  email: z.string().email()
});

export async function POST(req: Request){
  try{
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok:false, error:'Invalid request origin' },
        { status:403 }
      );
    }

    const me = await getUserFromCookie();
    if (!me) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });

    // CSRF protection for sensitive operations
    const isValidCSRF = await validateCSRFMiddleware(req, me.id);
    if (!isValidCSRF) {
      // Rate limiting for CSRF validation failures
      const clientKey = clientIpKey(req);
      try {
        await limitCSRFValidationFailures(clientKey);
      } catch (rateLimitError: any) {
        return NextResponse.json(
          { ok: false, error: 'Too many failed requests. Please try again later.' },
          { status: 429, headers: { 'Retry-After': rateLimitError.retryAfter?.toString() || '900' } }
        );
      }

      return NextResponse.json({ ok: false, error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await req.json();
    const data = Schema.parse(body);

    const emailChanged = data.email.toLowerCase() !== (me as any).email.toLowerCase();

    // Always update profile fields
    let pendingNotice = false;

    if (emailChanged){
      // Validate that new email isn't used by someone else or pending for another user
      const exists = await prisma.user.findFirst({
        where: {
          OR: [
            { email: data.email },
            { pendingEmail: data.email }
          ]
        }
      });
      if (exists && exists.id !== me.id){
        return NextResponse.json({ ok:false, error:'Email already in use' }, { status:409 });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour expiry

      await prisma.user.update({
        where: { id: me.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          address: data.address,
          pendingEmail: data.email,
          pendingEmailCode: code,
          pendingEmailExpires: expires
        }
      });

      await sendEmail(data.email, 'Verify your new email', `<p>Your verification code is <b>${code}</b>. It expires in 1 hour.</p>`);
      pendingNotice = true;
    } else {
       await prisma.user.update({
         where: { id: me.id },
         data: {
           firstName: data.firstName,
           lastName: data.lastName,
           phone: data.phone,
           address: data.address
         }
       });
     }

    return NextResponse.json({ ok:true, pending: pendingNotice });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message || 'Invalid' }, { status:400 });
  }
}
