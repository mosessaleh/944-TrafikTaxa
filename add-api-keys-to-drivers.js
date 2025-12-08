const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

async function addApiKeysToDrivers() {
  try {
    // Get all drivers without apiKey
    const drivers = await prisma.comDriver.findMany({
      where: { apiKey: null },
      select: { id: true }
    });

    console.log(`Found ${drivers.length} drivers without API keys`);

    for (const driver of drivers) {
      const apiKey = randomUUID();
      await prisma.comDriver.update({
        where: { id: driver.id },
        data: { apiKey }
      });
      console.log(`Updated driver ${driver.id} with API key: ${apiKey}`);
    }

    console.log('All drivers updated with API keys');
  } catch (error) {
    console.error('Error updating drivers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addApiKeysToDrivers();