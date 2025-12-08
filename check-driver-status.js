const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDriverStatus() {
  try {
    console.log('🔍 Checking driver online status...');

    const drivers = await prisma.comDriver.findMany({
      select: {
        id: true,
        drFname: true,
        drLname: true,
        isOnline: true,
        isActive: true,
        car: true
      }
    });

    console.log('👥 Drivers:');
    drivers.forEach(d => console.log(`  ID ${d.id}: ${d.drFname} ${d.drLname} - Online: ${d.isOnline} - Active: ${d.isActive} - Car: ${d.car || 'None'}`));

    const onlineDrivers = drivers.filter(d => d.isOnline && d.isActive && d.car);
    console.log(`\n🟢 Online active drivers with cars: ${onlineDrivers.length}`);

    console.log('\n🚗 Checking vehicle locations...');
    const vehicles = await prisma.comVehicles.findMany({
      select: {
        id: true,
        regNumber: true,
        lastLat: true,
        lastLon: true,
        lastLocationUpdate: true
      }
    });

    console.log('Vehicles:');
    vehicles.forEach(v => {
      const hasLocation = v.lastLat !== null && v.lastLon !== null;
      const recentUpdate = v.lastLocationUpdate && (Date.now() - v.lastLocationUpdate.getTime()) < 24 * 60 * 60 * 1000;
      console.log(`  ID ${v.id}: ${v.regNumber} - Has location: ${hasLocation} - Recent update: ${recentUpdate}`);
    });

    const vehiclesWithRecentLocation = vehicles.filter(v => v.lastLat !== null && v.lastLon !== null && v.lastLocationUpdate && (Date.now() - v.lastLocationUpdate.getTime()) < 24 * 60 * 60 * 1000);
    console.log(`\n📍 Vehicles with recent location: ${vehiclesWithRecentLocation.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDriverStatus();