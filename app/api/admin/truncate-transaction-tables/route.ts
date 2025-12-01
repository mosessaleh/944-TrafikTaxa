import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    await requireAdmin();

    console.log('Truncating transaction tables: auditlog, cardpayment, cryptopayment, invoice, notification, notificationsettings, ride');

    // Disable foreign key checks for MySQL
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0;`;

    // Truncate tables (MySQL syntax)
    await prisma.$executeRaw`TRUNCATE TABLE auditlog;`;
    await prisma.$executeRaw`TRUNCATE TABLE cardpayment;`;
    await prisma.$executeRaw`TRUNCATE TABLE cryptopayment;`;
    await prisma.$executeRaw`TRUNCATE TABLE invoice;`;
    await prisma.$executeRaw`TRUNCATE TABLE notification;`;
    await prisma.$executeRaw`TRUNCATE TABLE notificationsettings;`;
    await prisma.$executeRaw`TRUNCATE TABLE ride;`;

    // Re-enable foreign key checks
    await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1;`;

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