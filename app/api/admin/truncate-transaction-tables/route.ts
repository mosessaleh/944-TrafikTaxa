import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateRequestOrigin } from '@/lib/security-headers';
import { AuditEvent, AuditLogger } from '@/lib/audit-log';

function dangerZoneEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_ADMIN_DANGER_ZONE === 'true';
}

export async function POST(request: Request) {
  try {
    if (!dangerZoneEnabled()) {
      return NextResponse.json(
        { error: 'Danger zone is disabled in production' },
        { status: 403 }
      );
    }

    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const admin = await requirePermission('danger.manage');

    console.log('Truncating transaction tables: cardpayment, cryptopayment, invoice, notification, notificationsettings, ride');

    // Disable foreign key checks for MySQL
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`;

    // Truncate tables (MySQL syntax)
    await prisma.$executeRaw`TRUNCATE TABLE cardpayment;`;
    await prisma.$executeRaw`TRUNCATE TABLE cryptopayment;`;
    await prisma.$executeRaw`TRUNCATE TABLE invoice;`;
    await prisma.$executeRaw`TRUNCATE TABLE notification;`;
    await prisma.$executeRaw`TRUNCATE TABLE notificationsettings;`;
    await prisma.$executeRaw`TRUNCATE TABLE ride;`;

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`;

    await AuditLogger.log({
      event: AuditEvent.ADMIN_ACTION,
      userId: String(admin.id),
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        action: 'truncate_transaction_tables',
        tables: ['cardpayment', 'cryptopayment', 'invoice', 'notification', 'notificationsettings', 'ride']
      },
      severity: 'critical'
    });

    console.log('All transaction tables truncated successfully.');

    return NextResponse.json({
      success: true,
      message: 'All transaction tables have been truncated. Auto-increment IDs reset to 1.'
    });

  } catch (error: any) {
    console.error('Error truncating transaction tables:', error);
    return NextResponse.json(
      { error: 'Failed to truncate transaction tables', details: error.message },
      { status: 500 }
    );
  }
}
