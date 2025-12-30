const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRides() {
  try {
    const rides = await prisma.ride.findMany({
      where: { id: { in: [3, 4] } },
      select: {
        id: true,
        vehicleTypeId: true,
        status: true,
        driverId: true
      }
    });
    console.log('Rides 3 and 4:', rides);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRides();