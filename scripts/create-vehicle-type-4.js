const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createVehicleType4() {
  try {
    console.log('Creating vehicle type 4...');
    
    // Create vehicle type 4 since ride 13 uses it
    const vehicleType = await prisma.vehicleType.upsert({
      where: { id: 4 },
      update: {},
      create: {
        id: 4,
        key: 'VAN',
        title: 'Van',
        capacity: 8,
        active: true,
        multiplier: 1.5,
        note: 'Suitable for larger groups',
      }
    });
    
    console.log('✅ Vehicle type 4 created:', vehicleType);
    
  } catch (error) {
    console.error('❌ Error creating vehicle type:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createVehicleType4();