const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateVehicleLocations() {
  try {
    console.log('🚗 Starting to update vehicle locations based on driver locations...');

    // Get all drivers with their locations and car info
    const drivers = await prisma.comDriver.findMany({
      select: {
        id: true,
        drFname: true,
        drLname: true,
        car: true,
        lastLocation: true
      }
    });

    console.log(`📋 Found ${drivers.length} drivers to update vehicles for`);

    let updatedCount = 0;

    for (const driver of drivers) {
      if (driver.car && driver.lastLocation) {
        // Update the vehicle with the driver's location
        const updatedVehicle = await prisma.comVehicles.updateMany({
          where: {
            regNumber: driver.car
          },
          data: {
            lastLat: driver.lastLocation.lat,
            lastLon: driver.lastLocation.lon,
            lastLocationUpdate: new Date()
          }
        });

        if (updatedVehicle.count > 0) {
          console.log(`✅ Updated ${driver.drFname} ${driver.drLname}'s vehicle (${driver.car}) - Location: ${driver.lastLocation.lat.toFixed(4)}, ${driver.lastLocation.lon.toFixed(4)}`);
          updatedCount++;
        } else {
          console.log(`❌ Could not find vehicle with plate: ${driver.car} for driver ${driver.drFname} ${driver.drLname}`);
        }
      } else {
        console.log(`⚠️  Driver ${driver.drFname} ${driver.drLname} missing car or location info`);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} vehicle locations`);

    // Verify the updates
    const vehiclesWithLocations = await prisma.comVehicles.findMany({
      where: {
        lastLat: {
          not: null
        }
      },
      select: {
        id: true,
        regNumber: true,
        make: true,
        model: true,
        lastLat: true,
        lastLon: true,
        lastLocationUpdate: true
      }
    });

    console.log(`\n📍 Vehicles with location data: ${vehiclesWithLocations.length}`);
    vehiclesWithLocations.forEach(vehicle => {
      console.log(`  ${vehicle.make} ${vehicle.model} (${vehicle.regNumber}): ${vehicle.lastLat?.toFixed(4)}, ${vehicle.lastLon?.toFixed(4)} - Updated: ${vehicle.lastLocationUpdate?.toISOString()}`);
    });

  } catch (error) {
    console.error('❌ Error updating vehicle locations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateVehicleLocations();