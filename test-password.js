const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testPassword() {
  try {
    const partner = await prisma.partnerCompany.findFirst({ where: { comUserName: 'com45904474' } });
    if (!partner) {
      console.log('Partner not found');
      return;
    }

    const plainPassword = 'com45904474-45904474';
    const isValid = await bcrypt.compare(plainPassword, partner.comPass);

    console.log('Password valid:', isValid);
    console.log('Plain password:', plainPassword);
    console.log('Hashed password:', partner.comPass);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();