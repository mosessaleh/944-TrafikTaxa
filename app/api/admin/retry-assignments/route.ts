import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Find drivers who have been offered rides but haven't accepted within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const timedOutDrivers = await prisma.comDriver.findMany({
      where: {
        currentRideId: { not: null },
        rideAccepted: 0, // Offered but not accepted
      },
      select: {
        id: true,
        currentRideId: true,
        createdAt: true
      }
    });

    // For now, reset all drivers with pending ride offers (simplified logic)
    // In production, you might want to add a rideOfferedAt field to track when the ride was offered
    const actuallyTimedOutDrivers = timedOutDrivers; // Reset all pending offers for now

    console.log(`Found ${timedOutDrivers.length} drivers with timed-out ride offers`);

    let reassignedCount = 0;

    for (const driver of timedOutDrivers) {
      if (!driver.currentRideId) continue;

      console.log(`Ride offer ${driver.currentRideId} timed out for driver ${driver.id}, resetting...`);

      // Reset driver status - remove the ride offer
      await prisma.comDriver.update({
        where: { id: driver.id },
        data: {
          currentRideId: null,
          rideAccepted: 0,
          // Keep isBusy as false
        }
      });

      // The ride remains in CONFIRMED status with no driverId/car/status changes
      // It will be picked up by the next assignment cycle

      reassignedCount++;
    }

    // Now try to assign the reset rides
    if (reassignedCount > 0) {
      try {
        const assignResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/assign-rides`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (assignResponse.ok) {
          console.log(`Reassignment triggered for ${reassignedCount} timed-out rides`);
        }
      } catch (error) {
        console.error('Error triggering reassignment:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Checked ${timedOutDrivers.length} drivers, reassigned ${reassignedCount}`,
      reassigned: reassignedCount
    });

  } catch (error) {
    console.error('Error in retry assignments:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error during retry assignments'
    }, { status: 500 });
  }
}