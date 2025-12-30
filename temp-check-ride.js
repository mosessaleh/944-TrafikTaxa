const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRide() {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: 1 }
    });
    console.log('Ride 1:', ride);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRide();