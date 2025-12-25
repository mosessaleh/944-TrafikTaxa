const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestBooking() {
  try {
    console.log('Creating test booking...');

    // Create a test booking with CONFIRMED status
    const booking = await prisma.ride.create({
      data: {
        userId: 1, // Assuming user ID 1 exists
        riderName: 'Test Rider',
        passengers: 1,
        pickupAddress: 'Test Pickup Address',
        dropoffAddress: 'Test Dropoff Address',
        startLatLon: { lat: 55.6761, lon: 12.5683 }, // Copenhagen
        endLatLon: { lat: 55.6761, lon: 12.5683 },
        scheduled: false,
        pickupTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        distanceKm: 10,
        durationMin: 15,
        price: 100,
        status: 'CONFIRMED', // Booking is confirmed after payment
        paymentStatus: 'PENDING_PAYMENT',
        paymentMethod: 'card',
        vehicleTypeId: 1,
        driverQueue: []
      }
    });

    console.log('Test booking created with ID:', booking.id);

    // Now update the status to CONFIRMED if needed
    // But it's already CONFIRMED

  } catch (error) {
    console.error('Error creating test booking:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestBooking();