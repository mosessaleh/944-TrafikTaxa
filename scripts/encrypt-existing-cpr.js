/**
 * Migration script to encrypt existing CPR data in the database
 * Run this script after setting up CPR_ENCRYPTION_KEY in environment variables
 *
 * Usage: node scripts/encrypt-existing-cpr.js
 */

const { PrismaClient } = require('@prisma/client');
const { encryptCPR } = require('../lib/crypto');

const prisma = new PrismaClient();

async function encryptExistingCPR() {
  console.log('🔐 Starting CPR encryption migration...');

  try {
    // Get all drivers with CPR data
    const drivers = await prisma.comDriver.findMany({
      where: {
        cpr: {
          not: null
        }
      },
      select: {
        id: true,
        cpr: true
      }
    });

    console.log(`📊 Found ${drivers.length} drivers with CPR data`);

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const driver of drivers) {
      try {
        // Check if CPR is already encrypted (contains ':')
        if (driver.cpr.includes(':')) {
          console.log(`⏭️  Driver ${driver.id}: CPR already encrypted, skipping`);
          skippedCount++;
          continue;
        }

        // Encrypt the CPR
        const encryptedCPR = encryptCPR(driver.cpr);

        // Update the driver record
        await prisma.comDriver.update({
          where: { id: driver.id },
          data: { cpr: encryptedCPR }
        });

        console.log(`✅ Driver ${driver.id}: CPR encrypted successfully`);
        encryptedCount++;

      } catch (error) {
        console.error(`❌ Failed to encrypt CPR for driver ${driver.id}:`, error.message);
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`📈 Encrypted: ${encryptedCount} records`);
    console.log(`⏭️  Skipped: ${skippedCount} records`);
    console.log(`🔒 All CPR data is now encrypted at rest`);

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
encryptExistingCPR();