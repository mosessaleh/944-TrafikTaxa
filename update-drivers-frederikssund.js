const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Frederikssund area coordinates (approximate)
const baseLat = 55.83;
const baseLon = 12.07;
const radius = 0.05; // ~5km radius

function getRandomLocation() {
  const lat = baseLat + (Math.random() - 0.5) * radius;
  const lon = baseLon + (Math.random() - 0.5) * radius;
  return { lat, lon };
}

async function updateDriversToFrederikssund() {
  try {
    console.log('🚗 Updating driver locations to Frederikssund area...');

    // Get all drivers
    const drivers = await prisma.comDriver.findMany({
      select: {
        id: true,
        drFname: true,
        drLname: true,
        car: true
      }
    });

    console.log(`📋 Found ${drivers.length} drivers to update`);

    let updatedCount = 0;

    for (const driver of drivers) {
      const location = getRandomLocation();

      await prisma.comDriver.update({
        where: { id: driver.id },
        data: {
          lastLocation: location
        }
      });

      console.log(`✅ Updated ${driver.drFname} ${driver.drLname} - Location: ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`);
      updatedCount++;
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} driver locations`);

    // Update vehicle locations too
    console.log('\n🔄 Updating vehicle locations...');
    await require('./update-vehicle-locations.js');

  } catch (error) {
    console.error('❌ Error updating drivers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateDriversToFrederikssund();