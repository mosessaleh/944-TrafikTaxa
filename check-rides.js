const { PrismaClient } = require('@prisma/client');

async function checkRides() {
  const prisma = new PrismaClient();
  try {
    const rides = await prisma.ride.findMany({
      take: 5,
      select: { id: true, status: true, driverId: true }
    });
    console.log('Rides:', rides);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRides();