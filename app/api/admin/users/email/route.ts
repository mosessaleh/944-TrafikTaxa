import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';
import { notifyUserEmail, wrapWithBrandedTemplate } from '@/lib/notify';

const Schema = z.object({
  userId: z.number().int(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    // CSRF protection (Origin/Referer)
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Admin auth via signed JWT session
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (me.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, subject, body } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user || !user.email) {
      return NextResponse.json({ ok: false, error: 'User not found or has no email' }, { status: 404 });
    }

    const greetingName = user.firstName || user.lastName || 'Customer';

    // Wrap the raw HTML body inside the 944 Trafik branded email template
    const htmlBody = wrapWithBrandedTemplate(
      subject,
      `
        <p>Dear ${greetingName},</p>
        <div style="margin: 16px 0; line-height: 1.6;">
          ${body}
        </div>
        <p>Best regards,<br/>The 944 Trafik Team</p>
      `
    );

    const result = await notifyUserEmail(user.email, subject, htmlBody);

    if (!result || (result as any).ok === false) {
      return NextResponse.json(
        { ok: false, error: (result as any)?.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/users/email] error', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}