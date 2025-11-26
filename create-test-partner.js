const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestPartner() {
  try {
    // Hash the password
    const plainPassword = 'partner123';
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create test partner company
    const partner = await prisma.partnerCompany.upsert({
      where: { comUserName: 'testpartner' },
      update: {},
      create: {
        cvr: '12345678',
        comName: 'Test Partner Company',
        contactPerson: 'John Doe',
        comAddress: 'Test Address 123',
        comPhone: '+4512345678',
        comEmail: 'test@partner.com',
        comBankInfo: 'Test Bank Info',
        comStatus: true,
        commissionRate: 10.0,
        contractSigned: true,
        comUserName: 'testpartner',
        comPass: hashedPassword
      }
    });

    console.log('✅ Test partner company created successfully!');
    console.log('=====================================');
    console.log(`Company Name: ${partner.comName}`);
    console.log(`Username: ${partner.comUserName}`);
    console.log(`Password: ${plainPassword}`);
    console.log(`Email: ${partner.comEmail}`);
    console.log(`Phone: ${partner.comPhone}`);
    console.log(`Status: ${partner.comStatus ? 'Active' : 'Inactive'}`);
    console.log(`Contract Signed: ${partner.contractSigned ? 'Yes' : 'No'}`);
    console.log('');
    console.log('You can now login with:');
    console.log('- Username: testpartner');
    console.log('- Password: partner123');

  } catch (error) {
    console.error('❌ Error creating test partner:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPartner();