const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updatePartnerPassword() {
  try {
    const plainPassword = 'com45904474-45904474';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const updated = await prisma.partnerCompany.update({
      where: { comUserName: 'com45904474' },
      data: { comPass: hashedPassword }
    });

    console.log('✅ Password updated successfully!');
    console.log('Company:', updated.comName);
    console.log('Username:', updated.comUserName);
    console.log('New Password:', plainPassword);

  } catch (error) {
    console.error('❌ Error updating password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePartnerPassword();