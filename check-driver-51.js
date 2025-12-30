const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDriver() {
  try {
    const driver = await prisma.comDriver.findUnique({
      where: { id: 51 },
      select: {
        id: true,
        isOnline: true,
        isBusy: true,
        currentRideId: true,
        rideAccepted: true,
        car: true
      }
    });
    console.log('Driver 51 status:', driver);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDriver();