import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { validateRequestOrigin } from '@/lib/security-headers';
import { validateCSRFMiddleware } from '@/lib/csrf';
import { limitCSRFValidationFailures, clientIpKey } from '@/lib/rate-limit';

const Schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  address: z.string().min(1).optional(),
  email: z.string().email().optional(),
  language: z.enum(['dk', 'en']).optional()
}).refine((data) => {
  // For language-only updates, make other fields truly optional
  if (Object.keys(data).length === 1 && data.language) {
    return true;
  }
  // For other updates, validate normally
  return true;
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

    const body = await req.json();

    // CSRF protection for sensitive operations (skip for language-only updates)
    const isLanguageOnly = Object.keys(body).length === 1 && 'language' in body;

    if (!isLanguageOnly) {
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
    }
    const data = Schema.parse(body);

    // Check if email is being changed
    const emailChanged = data.email && data.email.toLowerCase() !== (me as any).email.toLowerCase();

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

      const code = crypto.randomInt(100000, 999999).toString();
      const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour expiry

      await prisma.user.update({
        where: { id: me.id },
        data: {
          ...(data.firstName && { firstName: data.firstName }),
          ...(data.lastName && { lastName: data.lastName }),
          ...(data.phone && { phone: data.phone }),
          ...(data.address && { address: data.address }),
          ...(data.language && { language: data.language }),
          pendingEmail: data.email,
          pendingEmailCode: code,
          pendingEmailExpires: expires
        }
      });

      await sendEmail(data.email!, 'Verify your new email', `<p>Your verification code is <b>${code}</b>. It expires in 1 hour.</p>`);
      pendingNotice = true;
    } else {
        await prisma.user.update({
          where: { id: me.id },
          data: {
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
            ...(data.phone && { phone: data.phone }),
            ...(data.address && { address: data.address }),
            ...(data.language && { language: data.language })
          }
        });
      }

    return NextResponse.json({ ok:true, pending: pendingNotice });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message || 'Invalid' }, { status:400 });
  }
}
