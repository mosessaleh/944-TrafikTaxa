const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addDriverIdsToVehicles() {
  try {
    console.log('🚗 Adding driver IDs (uId) to vehicles...');

    // Get all drivers with their car info
    const drivers = await prisma.comDriver.findMany({
      select: {
        id: true,
        drFname: true,
        drLname: true,
        car: true
      }
    });

    console.log(`📋 Found ${drivers.length} drivers to link with vehicles`);

    let updatedCount = 0;

    for (const driver of drivers) {
      if (driver.car) {
        // Update the vehicle with the driver ID
        const updatedVehicle = await prisma.comVehicles.updateMany({
          where: {
            regNumber: driver.car
          },
          data: {
            uId: driver.id
          }
        });

        if (updatedVehicle.count > 0) {
          console.log(`✅ Added driver ID ${driver.id} to vehicle ${driver.car} (${driver.drFname} ${driver.drLname})`);
          updatedCount++;
        } else {
          console.log(`❌ Could not find vehicle with plate: ${driver.car} for driver ${driver.drFname} ${driver.drLname}`);
        }
      } else {
        console.log(`⚠️  Driver ${driver.drFname} ${driver.drLname} has no assigned car`);
      }
    }

    console.log(`\n🎉 Successfully added driver IDs to ${updatedCount} vehicles`);

    // Simple verification
    const vehicles = await prisma.comVehicles.findMany({
      select: {
        id: true,
        regNumber: true,
        make: true,
        model: true,
        uId: true
      },
      where: {
        uId: {
          not: null
        }
      }
    });

    console.log(`\n📋 Vehicles with driver assignments:`);
    vehicles.forEach(vehicle => {
      console.log(`  ${vehicle.make} ${vehicle.model} (${vehicle.regNumber}) → Driver ID: ${vehicle.uId}`);
    });

  } catch (error) {
    console.error('❌ Error adding driver IDs to vehicles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDriverIdsToVehicles();