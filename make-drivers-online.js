const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAllDriversOnline() {
  try {
    console.log('🚀 Making all drivers online...');

    const result = await prisma.comdriver.updateMany({
      data: {
        isOnline: true
      }
    });

    console.log(`✅ Updated ${result.count} drivers to online status`);

  } catch (error) {
    console.error('❌ Error updating drivers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeAllDriversOnline();