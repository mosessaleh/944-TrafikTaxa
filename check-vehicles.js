const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVehicles() {
  try {
    const vehicles = await prisma.comVehicles.findMany({
      take: 10,
      select: { id: true, regNumber: true, vehicleType: true, comId: true, uId: true }
    });
    console.log('Vehicles:', vehicles);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicles();