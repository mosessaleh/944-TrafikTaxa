const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Define locations (outside Hillerød bounds)
const locations = {
  helsingor: { lat: 56.036, lon: 12.613 },
  helsinge: { lat: 55.99, lon: 12.15 },
  roskilde: { lat: 55.64, lon: 12.08 }
};

function getRandomOffset() {
  return (Math.random() - 0.5) * 0.04; // +/- 0.02 degrees for more spread
}

async function redistributeVehicles() {
  try {
    console.log('🚗 Starting to redistribute vehicles from Hillerød...');

    // Define Hillerød area bounds (more precise)
    const hillerodBounds = {
      latMin: 55.90,
      latMax: 55.96,
      lonMin: 12.25,
      lonMax: 12.35
    };

    // Get vehicles in Hillerød area
    const hillerodVehicles = await prisma.comVehicles.findMany({
      where: {
        lastLat: {
          gte: hillerodBounds.latMin,
          lte: hillerodBounds.latMax
        },
        lastLon: {
          gte: hillerodBounds.lonMin,
          lte: hillerodBounds.lonMax
        }
      },
      select: {
        id: true,
        regNumber: true,
        make: true,
        model: true,
        lastLat: true,
        lastLon: true
      }
    });

    console.log(`📋 Found ${hillerodVehicles.length} vehicles in Hillerød area`);

    if (hillerodVehicles.length <= 4) {
      console.log('✅ Already 4 or fewer vehicles in Hillerød, no redistribution needed');
      return;
    }

    // Keep first 4 vehicles
    const vehiclesToKeep = hillerodVehicles.slice(0, 4);
    const vehiclesToMove = hillerodVehicles.slice(4);

    console.log(`🛑 Keeping ${vehiclesToKeep.length} vehicles in Hillerød:`);
    vehiclesToKeep.forEach(v => console.log(`  ${v.make} ${v.model} (${v.regNumber})`));

    console.log(`\n🚚 Moving ${vehiclesToMove.length} vehicles to other cities`);

    // Distribute to 3 cities
    const cities = ['helsingor', 'helsinge', 'roskilde'];
    const perCity = Math.floor(vehiclesToMove.length / 3);
    const remainder = vehiclesToMove.length % 3;

    let movedCount = 0;

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      const count = perCity + (i < remainder ? 1 : 0);
      const cityVehicles = vehiclesToMove.slice(movedCount, movedCount + count);

      console.log(`\n🏙️ Moving ${count} vehicles to ${city}:`);

      for (const vehicle of cityVehicles) {
        const baseLat = locations[city].lat;
        const baseLon = locations[city].lon;
        const newLat = baseLat + getRandomOffset();
        const newLon = baseLon + getRandomOffset();

        // Update vehicle location
        await prisma.comVehicles.update({
          where: { id: vehicle.id },
          data: {
            lastLat: newLat,
            lastLon: newLon,
            lastLocationUpdate: new Date()
          }
        });

        // Also update the driver's location to keep them in sync
        await prisma.comDriver.updateMany({
          where: {
            car: vehicle.regNumber
          },
          data: {
            lastLocation: {
              lat: newLat,
              lon: newLon
            }
          }
        });

        console.log(`  ✅ ${vehicle.make} ${vehicle.model} (${vehicle.regNumber}) -> ${newLat.toFixed(4)}, ${newLon.toFixed(4)}`);
      }

      movedCount += count;
    }

    console.log(`\n🎉 Successfully redistributed ${vehiclesToMove.length} vehicles`);

    // Verify final distribution
    const finalHillerodVehicles = await prisma.comVehicles.findMany({
      where: {
        lastLat: {
          gte: hillerodBounds.latMin,
          lte: hillerodBounds.latMax
        },
        lastLon: {
          gte: hillerodBounds.lonMin,
          lte: hillerodBounds.lonMax
        }
      },
      select: {
        regNumber: true,
        make: true,
        model: true,
        lastLat: true,
        lastLon: true
      }
    });

    console.log(`\n📍 Vehicles remaining in Hillerød: ${finalHillerodVehicles.length}`);
    finalHillerodVehicles.forEach(v => {
      console.log(`  ${v.make} ${v.model} (${v.regNumber}): ${v.lastLat?.toFixed(4)}, ${v.lastLon?.toFixed(4)}`);
    });

  } catch (error) {
    console.error('❌ Error redistributing vehicles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

redistributeVehicles();