import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const Schema = z.object({
  id: z.number().int(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  role: z.enum(['USER', 'ADMIN']),
  emailVerified: z.boolean(),
  canPayByInvoice: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (me.type !== 'user' || (me as any).role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, firstName, lastName, phone, address, role, emailVerified, canPayByInvoice } =
      parsed.data;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        // Prisma types لا تقبل null هنا، نستخدم undefined لمسح القيمة
        phone: phone ? phone : undefined,
        address: address ? address : undefined,
        role,
        emailVerified,
        canPayByInvoice: !!canPayByInvoice,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        role: true,
        emailVerified: true,
        canPayByInvoice: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        ...updated,
        createdAt: updated.createdAt?.toISOString?.() ?? null,
      },
    });
  } catch (e: any) {
    console.error('[admin/users/update] error', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to update user' },
      { status: 500 }
    );
  }
}