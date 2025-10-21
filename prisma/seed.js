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
}

main().then(()=>prisma.$disconnect()).catch(async e=>{console.error(e);await prisma.$disconnect();process.exit(1)});
