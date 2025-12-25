const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDriversCompanies() {
  try {
    const drivers = await prisma.comDriver.findMany({
      take: 5,
      include: {
        company: {
          select: { id: true, comName: true, vehicles: { select: { id: true, regNumber: true, vehicleType: true } } }
        }
      }
    });
    console.log('Drivers with companies:', JSON.stringify(drivers, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDriversCompanies();