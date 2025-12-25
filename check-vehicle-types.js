const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkVehicleTypes() {
  try {
    const types = await prisma.vehicleType.findMany();
    console.log('Vehicle Types:', types);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVehicleTypes();