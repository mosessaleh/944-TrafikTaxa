const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Simulate vehicle movement by slightly changing coordinates
function simulateMovement(lat, lon) {
  // Move by a small random amount (simulate driving)
  // Max movement: ~100-500 meters per 15 seconds (depending on speed)
  const maxMovement = 0.005; // ~500 meters in lat/lon degrees
  const latChange = (Math.random() - 0.5) * maxMovement;
  const lonChange = (Math.random() - 0.5) * maxMovement;

  return {
    lat: lat + latChange,
    lon: lon + lonChange
  };
}

async function updateVehicleLocations() {
  try {
    // Get all vehicles with current locations
    const vehicles = await prisma.comvehicles.findMany({
      where: {
        lastLat: { not: null },
        lastLon: { not: null }
      },
      select: {
        id: true,
        lastLat: true,
        lastLon: true,
        regNumber: true
      }
    });

    console.log(`📍 Updating ${vehicles.length} vehicle locations...`);

    // Update each vehicle's location
    for (const vehicle of vehicles) {
      if (vehicle.lastLat && vehicle.lastLon) {
        const newLocation = simulateMovement(vehicle.lastLat, vehicle.lastLon);

        await prisma.comvehicles.update({
          where: { id: vehicle.id },
          data: {
            lastLat: newLocation.lat,
            lastLon: newLocation.lon,
            lastLocationUpdate: new Date()
          }
        });

        // Also update driver's location
        const driver = await prisma.comdriver.findFirst({
          where: { car: vehicle.regNumber }
        });

        if (driver) {
          await prisma.comdriver.update({
            where: { id: driver.id },
            data: {
              lastLocation: {
                lat: newLocation.lat,
                lon: newLocation.lon
              }
            }
          });
        }
      }
    }

    console.log(`✅ Updated ${vehicles.length} vehicles at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('❌ Error updating vehicle locations:', error);
  }
}

async function startSimulation() {
  console.log('🚗 Starting vehicle movement simulation...');
  console.log('📡 Vehicles will move every 15 seconds');

  // Update immediately on start
  await updateVehicleLocations();

  // Then update every 15 seconds
  setInterval(async () => {
    await updateVehicleLocations();
  }, 15000); // 15 seconds
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping vehicle movement simulation...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Stopping vehicle movement simulation...');
  await prisma.$disconnect();
  process.exit(0);
});

startSimulation();