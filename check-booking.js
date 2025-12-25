const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBooking() {
  try {
    const booking = await prisma.ride.findUnique({
      where: { id: 5 }
    });
    console.log('Booking:', booking);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBooking();