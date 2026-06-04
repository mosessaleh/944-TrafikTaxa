import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';
import { AuditEvent, AuditLogger } from '@/lib/audit-log';

const Schema = z.object({
  id: z.number().int(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'FINANCE', 'SUPPORT', 'PARTNER_MANAGER']),
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

    const me = await requirePermission('users.manage');

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

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { role: true, email: true }
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    if (existing.role !== role) {
      await requirePermission('users.manage_roles');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        // Prisma types لا تقبل null هنا، نستخدم undefined لمسح القيمة
        phone: phone ? phone : undefined,
        address: address ? address : undefined,
        role: role as any,
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

    await AuditLogger.log({
      event: AuditEvent.ADMIN_ACTION,
      userId: String((me as any).id),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
      metadata: {
        action: 'user_update',
        targetUserId: id,
        targetEmail: existing.email,
        previousRole: existing.role,
        nextRole: role
      },
      severity: existing.role !== role ? 'high' : 'medium'
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
