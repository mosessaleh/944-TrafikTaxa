const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateVehicleDrivers() {
  try {
    console.log('Updating vehicle uId with driver IDs...');

    // Get all drivers with their cars
    const drivers = await prisma.comDriver.findMany({
      select: { id: true, car: true }
    });

    for (const driver of drivers) {
      if (driver.car) {
        await prisma.comVehicles.updateMany({
          where: { regNumber: driver.car },
          data: { uId: driver.id }
        });
        console.log(`Updated vehicle ${driver.car} with driver ID ${driver.id}`);
      }
    }

    console.log('All vehicle driver IDs updated!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateVehicleDrivers();