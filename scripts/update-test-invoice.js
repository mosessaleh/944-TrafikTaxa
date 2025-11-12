const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateTestInvoice() {
  try {
    console.log('Updating test invoice...');
    
    // Update the existing invoice with ID 3
    const testInvoice = await prisma.invoice.update({
      where: { id: 3 },
      data: {
        paymentStatus: 'PAID',
        status: 1,
        updatedAt: new Date(),
      }
    });
    
    console.log('✅ Test invoice updated:', testInvoice);
    
    // Also create/update a test ride if needed
    const testRide = await prisma.ride.upsert({
      where: { id: 1 },
      update: {
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
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
    console.error('❌ Error updating test invoice:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTestInvoice();