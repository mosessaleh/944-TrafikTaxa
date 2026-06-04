import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';
import { AuditEvent, AuditLogger } from '@/lib/audit-log';

const Schema = z.object({
  email: z.string().email(),
  role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'FINANCE', 'SUPPORT', 'PARTNER_MANAGER'])
});

export async function POST(req: Request){
  const originCheck = validateRequestOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { ok:false, error:'Invalid request origin' },
      { status:403 }
    );
  }

  const me = await requirePermission('users.manage_roles');
  const { email, role } = Schema.parse(await req.json());
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true }
  });

  await prisma.user.update({ where: { email }, data: { role: role as any } });

  await AuditLogger.log({
    event: AuditEvent.ADMIN_ACTION,
    userId: String((me as any).id),
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
    metadata: {
      action: 'user_role_change',
      targetUserId: existing?.id,
      targetEmail: email,
      previousRole: existing?.role,
      nextRole: role
    },
    severity: 'high'
  });

  return NextResponse.json({ ok:true });
}
