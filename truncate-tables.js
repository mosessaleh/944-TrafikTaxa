const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function truncateTables() {
  try {
    console.log('Truncating tables: auditlog, cardpayment, cryptopayment, invoice, notification, notificationsettings, ride');

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

    console.log('All tables truncated successfully. Auto-increment IDs will restart from 1.');
  } catch (error) {
    console.error('Error truncating tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

truncateTables();