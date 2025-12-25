const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearCurrentRides() {
  try {
    const result = await prisma.comDriver.updateMany({
      data: {
        currentRideId: null,
        rideAccepted: 0
      }
    });
    console.log('Updated:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearCurrentRides();