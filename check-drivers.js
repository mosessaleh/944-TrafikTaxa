const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDrivers() {
  try {
    const drivers = await prisma.comDriver.findMany({ take: 5 });
    console.log('Drivers:', drivers.map(d => ({ id: d.id, name: d.drFname + ' ' + d.drLname, car: d.car })));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDrivers();