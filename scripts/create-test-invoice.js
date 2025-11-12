const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestInvoice() {
  try {
    console.log('Creating test invoice...');
    
    // Create a test invoice with ID 3
    const testInvoice = await prisma.invoice.create({
      data: {
        id: 3,
        invoiceNumber: 'TEST-0003',
        userId: 1,
        rideId: 1,
        dueDate: new Date(),
        paymentStatus: 'PAID',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    
    console.log('✅ Test invoice created:', testInvoice);
    
    // Also create a test ride if needed
    const testRide = await prisma.ride.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        userId: 1,
        riderName: 'Test User',
        pickupAddress: 'Test Pickup',
        dropoffAddress: 'Test Dropoff',
        pickupTime: new Date(),
        price: 100,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'card',
        vehicleTypeId: 1,
      }
    });
    
    console.log('✅ Test ride created/updated:', testRide);
    
  } catch (error) {
    console.error('❌ Error creating test invoice:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestInvoice();