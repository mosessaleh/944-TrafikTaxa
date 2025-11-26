const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPartners() {
  try {
    const partners = await prisma.partnerCompany.findMany({
      select: {
        id: true,
        comName: true,
        comUserName: true,
        comPass: true,
        comStatus: true,
        contractSigned: true
      }
    });

    console.log('Partner Companies:');
    console.log('==================');

    if (partners.length === 0) {
      console.log('No partner companies found in database.');
      console.log('\nTo create a test partner company, you can run:');
      console.log('npx prisma studio');
      console.log('Then add a record to PartnerCompany table with:');
      console.log('- comUserName: testpartner');
      console.log('- comPass: partner123 (hashed)');
      console.log('- comName: Test Partner Company');
      console.log('- Other required fields...');
    } else {
      partners.forEach((partner, index) => {
        console.log(`${index + 1}. ${partner.comName}`);
        console.log(`   Username: ${partner.comUserName}`);
        console.log(`   Password Hash: ${partner.comPass}`);
        console.log(`   Status: ${partner.comStatus ? 'Active' : 'Inactive'}`);
        console.log(`   Contract Signed: ${partner.contractSigned ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPartners();