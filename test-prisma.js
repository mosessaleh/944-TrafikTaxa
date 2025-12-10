const { PrismaClient } = require('@prisma/client');

async function testPrisma() {
  const prisma = new PrismaClient();

  try {
    console.log('Testing Prisma connection...');

    // Test a simple query
    const count = await prisma.partnerCompany.count();
    console.log(`✅ Prisma is working! Found ${count} companies.`);

    // Test if tables exist
    const tables = ['PartnerCompany', 'comDriver', 'comVehicles'];
    for (const table of tables) {
      try {
        const result = await prisma[table].count();
        console.log(`✅ Table ${table}: ${result} records`);
      } catch (error) {
        console.log(`❌ Table ${table}: Error - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Prisma test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();