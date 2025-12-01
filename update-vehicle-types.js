const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateVehicleTypes() {
  try {
    console.log('Updating vehicle types for existing vehicles...');

    // Get all vehicles
    const vehicles = await prisma.comVehicles.findMany({
      select: { id: true, regNumber: true }
    });

    // Assign types based on index or random
    const types = ['SEDAN5', 'SEVEN_NO_BAG', 'VAN', 'LIMO'];

    for (let i = 0; i < vehicles.length; i++) {
      const type = types[i % types.length];
      await prisma.comVehicles.update({
        where: { id: vehicles[i].id },
        data: { vehicleType: type }
      });
      console.log(`Updated ${vehicles[i].regNumber} to type ${type}`);
    }

    console.log('All vehicle types updated!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateVehicleTypes();