const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding payment methods...');

  // Card Payment
  await prisma.paymentMethod.upsert({
    where: { key: 'card' },
    update: {
      title: 'Credit/Debit Card',
      description: 'Pay securely with your credit or debit card',
      isActive: true,
      devPublicKey: process.env.STRIPE_PUBLIC_KEY,
      devSecretKey: process.env.STRIPE_SECRET_KEY
    },
    create: {
      key: 'card',
      title: 'Credit/Debit Card',
      description: 'Pay securely with your credit or debit card',
      isActive: true,
      devPublicKey: process.env.STRIPE_PUBLIC_KEY,
      devSecretKey: process.env.STRIPE_SECRET_KEY
    }
  });

  // Crypto Payment
  await prisma.paymentMethod.upsert({
    where: { key: 'crypto' },
    update: {
      title: 'Cryptocurrency',
      description: 'Pay with Bitcoin, USDT, USDC, or Pi Network',
      isActive: true
    },
    create: {
      key: 'crypto',
      title: 'Cryptocurrency',
      description: 'Pay with Bitcoin, USDT, USDC, or Pi Network',
      isActive: true
    }
  });

  // PayPal Payment
  await prisma.paymentMethod.upsert({
    where: { key: 'paypal' },
    update: {
      title: 'PayPal',
      description: 'Pay with your PayPal account',
      isActive: true
    },
    create: {
      key: 'paypal',
      title: 'PayPal',
      description: 'Pay with your PayPal account',
      isActive: true
    }
  });

  // Revolut Payment
  await prisma.paymentMethod.upsert({
    where: { key: 'revolut' },
    update: {
      title: 'Revolut',
      description: 'Pay with your Revolut account',
      isActive: true
    },
    create: {
      key: 'revolut',
      title: 'Revolut',
      description: 'Pay with your Revolut account',
      isActive: true
    }
  });

  // Invoice Payment
  await prisma.paymentMethod.upsert({
    where: { key: 'invoice' },
    update: {
      title: 'Invoice',
      description: 'Pay by invoice (available for approved customers)',
      isActive: true
    },
    create: {
      key: 'invoice',
      title: 'Invoice',
      description: 'Pay by invoice (available for approved customers)',
      isActive: true
    }
  });

  console.log('Payment methods seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
