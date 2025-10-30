import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Admin user (email verified) — كلمة السر: admin1234 (سيتم استبدالها لاحقاً يدويًا)
  const bcrypt = (await import('bcrypt')).default;
  const hash = await bcrypt.hash('admin1234', 10);
  await prisma.user.upsert({
    where: { email: 'trafik@944.dk' },
    update: {},
    create: {
      email: 'trafik@944.dk',
      hashedPassword: hash,
      firstName: 'Admin',
      lastName: '944',
      phone: '26444944',
      street: 'HQ Street',
      houseNumber: '1',
      postalCode: '3600',
      city: 'Frederikssund',
      role: 'ADMIN',
      emailVerified: true
    }
  });

  // Default settings
  const settingsCount = await prisma.settings.count();
  if (!settingsCount) {
    await prisma.settings.create({
      data: {
        dayBase: 40.00,
        dayPerKm: 12.75,
        dayPerMin: 5.75,
        nightBase: 60.00,
        nightPerKm: 16.00,
        nightPerMin: 7.00,
        workStart: '06:00',
        workEnd: '18:00'
      }
    });
  }

  // Payment methods - Always seed these, don't check if they exist
  const paymentMethods = [
    {
      key: 'card',
      title: 'Card Payment',
      description: 'Secure credit card payment',
      isActive: true,
      devPublicKey: 'pk_test_...',
      devSecretKey: 'sk_test_...',
      devWebhookSecret: 'whsec_test_...',
      prodPublicKey: 'pk_live_...',
      prodSecretKey: 'sk_live_...',
      prodWebhookSecret: 'whsec_live_...'
    },
    {
      key: 'crypto',
      title: 'Crypto Payment',
      description: 'Payment with cryptocurrencies',
      isActive: true,
      devPublicKey: null,
      devSecretKey: null,
      devWebhookSecret: null,
      prodPublicKey: null,
      prodSecretKey: null,
      prodWebhookSecret: null
    },
    {
      key: 'paypal',
      title: 'PayPal',
      description: 'Payment via PayPal',
      isActive: true,
      devPublicKey: 'PAYPAL_DEV_CLIENT_ID',
      devSecretKey: 'PAYPAL_DEV_CLIENT_SECRET',
      devWebhookSecret: null,
      prodPublicKey: 'PAYPAL_PROD_CLIENT_ID',
      prodSecretKey: 'PAYPAL_PROD_CLIENT_SECRET',
      prodWebhookSecret: null
    },
    {
      key: 'revolut',
      title: 'Revolut',
      description: 'Payment via Revolut',
      isActive: true,
      devPublicKey: 'REVOLUT_DEV_API_KEY',
      devSecretKey: 'REVOLUT_DEV_SECRET',
      devWebhookSecret: null,
      prodPublicKey: 'REVOLUT_PROD_API_KEY',
      prodSecretKey: 'REVOLUT_PROD_SECRET',
      prodWebhookSecret: null
    },
    {
      key: 'invoice',
      title: 'Invoice',
      description: 'Payment by invoice (authorized users only)',
      isActive: true,
      devPublicKey: null,
      devSecretKey: null,
      devWebhookSecret: null,
      prodPublicKey: null,
      prodSecretKey: null,
      prodWebhookSecret: null
    }
  ];

  for (const method of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { key: method.key },
      update: {},
      create: method
    });
  }
}

main().then(()=>prisma.$disconnect()).catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)});
