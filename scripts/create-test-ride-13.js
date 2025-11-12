const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestRide13() {
  try {
    console.log('Creating/updating test ride 13...');
    
    // Create/update a test ride with ID 13
    const testRide = await prisma.ride.upsert({
      where: { id: 13 },
      update: {
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
      create: {
        id: 13,
        userId: 1,
        riderName: 'Test User for Invoice 3',
        passengers: 2,
        pickupAddress: 'Test Pickup Address 13',
        dropoffAddress: 'Test Dropoff Address 13',
        scheduled: false,
        pickupTime: new Date(),
        price: 150,
        status: 'COMPLETED',
        explanation: 'Test ride for invoice 3',
        paymentStatus: 'PAID',
        paymentMethod: 'card',
        vehicleTypeId: 1,
      }
    });
    
    console.log('✅ Test ride 13 created/updated:', testRide);
    
    // Also ensure vehicleType exists
    const vehicleType = await prisma.vehicleType.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        key: 'SEDAN5',
        title: 'Sedan (5 passengers)',
        capacity: 5,
        active: true,
      }
    });
    
    console.log('✅ Vehicle type ensured:', vehicleType);
    
  } catch (error) {
    console.error('❌ Error creating test ride:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestRide13();