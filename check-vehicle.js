const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVehicle() {
  try {
    const vehicle = await prisma.comVehicles.findFirst({
      where: { regNumber: 'NN 80 139' },
      select: {
        id: true,
        regNumber: true,
        vehicleType: true
      }
    });
    console.log('Vehicle NN 80 139:', vehicle);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicle();