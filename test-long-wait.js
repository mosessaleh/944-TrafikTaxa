// Test script for long wait functionality
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupLongWaitTest() {
  try {
    console.log('Setting up long wait test scenario...');

    // Test location: Copenhagen city center
    const testPickupLat = 55.6761;
    const testPickupLon = 12.5683;

    // Update all vehicles to be far from the test location (more than 1 hour away)
    // Copenhagen to Stockholm (Sweden) is about 6 hours drive, so let's place vehicles there
    const farLat = 59.3293; // Stockholm, Sweden
    const farLon = 18.0686;

    const vehicles = await prisma.comVehicles.findMany({
      select: { id: true, regNumber: true, lastLat: true, lastLon: true }
    });

    console.log(`Found ${vehicles.length} vehicles. Moving them far away...`);

    for (const vehicle of vehicles) {
      // Add some random variation so they're not all at the exact same spot
      const randomLat = farLat + (Math.random() - 0.5) * 0.1;
      const randomLon = farLon + (Math.random() - 0.5) * 0.1;

      await prisma.comVehicles.update({
        where: { id: vehicle.id },
        data: {
          lastLat: randomLat,
          lastLon: randomLon,
          lastLocationUpdate: new Date()
        }
      });

      console.log(`Moved vehicle ${vehicle.regNumber} to (${randomLat}, ${randomLon})`);
    }

    // Make sure drivers are online and active
    const drivers = await prisma.comDriver.findMany({
      select: { id: true, isOnline: true, isActive: true, car: true }
    });

    console.log(`Found ${drivers.length} drivers. Ensuring they're online...`);

    for (const driver of drivers) {
      if (driver.car) {
        await prisma.comDriver.update({
          where: { id: driver.id },
          data: {
            isOnline: true,
            isActive: true,
            currentRideId: null // Make sure they're not busy
          }
        });
        console.log(`Made driver ${driver.id} online`);
      }
    }

    console.log('Test setup complete!');
    console.log(`Test pickup location: (${testPickupLat}, ${testPickupLon}) - Copenhagen city center`);
    console.log(`Vehicles moved to: Around (${farLat}, ${farLon}) - Stockholm, Sweden (about 6 hours drive)`);

  } catch (error) {
    console.error('Error setting up test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupLongWaitTest();