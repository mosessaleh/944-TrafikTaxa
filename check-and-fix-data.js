const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAndFixData() {
  try {
    console.log('🔍 Checking current data...');

    // Check companies
    const companies = await prisma.partnerCompany.findMany({
      select: { id: true, comName: true }
    });
    console.log('🏢 Companies:');
    companies.forEach(c => console.log(`  ID ${c.id}: ${c.comName}`));

    // Check drivers
    const drivers = await prisma.comDriver.findMany({
      select: { id: true, drFname: true, drLname: true, comId: true, car: true }
    });
    console.log('\n👥 Drivers:');
    drivers.forEach(d => console.log(`  ID ${d.id}: ${d.drFname} ${d.drLname} - Company: ${d.comId} - Car: ${d.car || 'None'}`));

    // Check vehicles
    const vehicles = await prisma.comVehicles.findMany({
      select: { id: true, regNumber: true, make: true, model: true, comId: true }
    });
    console.log('\n🚗 Vehicles:');
    vehicles.forEach(v => console.log(`  ID ${v.id}: ${v.make} ${v.model} (${v.regNumber}) - Company: ${v.comId}`));

    // Fix the data
    console.log('\n🔧 Fixing data...');

    // Update driver company IDs to match actual companies
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      const correctCompanyId = companies[Math.floor(i / 5)].id; // 5 drivers per company

      if (driver.comId !== correctCompanyId) {
        await prisma.comDriver.update({
          where: { id: driver.id },
          data: { comId: correctCompanyId }
        });
        console.log(`✅ Updated driver ${driver.drFname} ${driver.drLname} company from ${driver.comId} to ${correctCompanyId}`);
      }
    }

    // Update vehicle company IDs to match actual companies
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const correctCompanyId = companies[Math.floor(i / 5)].id; // 5 vehicles per company

      if (vehicle.comId !== correctCompanyId) {
        await prisma.comVehicles.update({
          where: { id: vehicle.id },
          data: { comId: correctCompanyId }
        });
        console.log(`✅ Updated vehicle ${vehicle.regNumber} company from ${vehicle.comId} to ${correctCompanyId}`);
      }
    }

    // Re-link drivers to vehicles within their company
    console.log('\n🔗 Re-linking drivers to vehicles...');

    for (const company of companies) {
      const companyDrivers = await prisma.comDriver.findMany({
        where: { comId: company.id }
      });

      const companyVehicles = await prisma.comVehicles.findMany({
        where: { comId: company.id }
      });

      for (let i = 0; i < companyDrivers.length; i++) {
        const driver = companyDrivers[i];
        const vehicle = companyVehicles[i];

        if (driver.car !== vehicle.regNumber) {
          await prisma.comDriver.update({
            where: { id: driver.id },
            data: { car: vehicle.regNumber }
          });
          console.log(`✅ Linked driver ${driver.drFname} ${driver.drLname} to vehicle ${vehicle.regNumber}`);
        }
      }
    }

    console.log('\n🎉 Data fixed successfully!');

    // Final verification
    console.log('\n📋 Final verification:');
    const finalDrivers = await prisma.comDriver.findMany({
      include: {
        company: {
          select: { comName: true }
        }
      }
    });

    finalDrivers.forEach(d => {
      console.log(`  ${d.drFname} ${d.drLname} → ${d.company.comName} → ${d.car}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixData();