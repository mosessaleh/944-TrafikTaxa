const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateVehicleUpdates() {
  try {
    console.log('Updating vehicle location updates to now...');

    const result = await prisma.comVehicles.updateMany({
      data: {
        lastLocationUpdate: new Date()
      }
    });

    console.log(`Updated ${result.count} vehicles`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateVehicleUpdates();