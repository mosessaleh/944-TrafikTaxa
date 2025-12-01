const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateDriversOnline() {
  try {
    console.log('Setting all drivers online and updating vehicle locations...');

    // Get all drivers
    const drivers = await prisma.comDriver.findMany();

    for (const driver of drivers) {
      // Set driver online, active, and clear current ride
      await prisma.comDriver.update({
        where: { id: driver.id },
        data: {
          isOnline: true,
          isActive: true,
          currentRideId: null
        }
      });

      // Update vehicle location if driver has car and location
      if (driver.car && driver.lastLocation) {
        await prisma.comVehicles.updateMany({
          where: { regNumber: driver.car },
          data: {
            lastLat: driver.lastLocation.lat,
            lastLon: driver.lastLocation.lon,
            lastLocationUpdate: new Date()
          }
        });
        console.log(`Updated vehicle ${driver.car} location`);
      }
    }

    console.log('All drivers set online and vehicle locations updated!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDriversOnline();