const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDrivers() {
  try {
    const drivers = await prisma.comDriver.findMany({
      take: 5,
      select: { id: true, isOnline: true, lastLocation: true, car: true, currentRideId: true, rideAccepted: true }
    });
    console.log('Drivers:', drivers);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDrivers();