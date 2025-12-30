import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Get all confirmed rides without drivers
    const pendingRides = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED',
        paymentMethod: { not: null },
        driverId: null,
        car: null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        vehicleType: {
          select: {
            id: true,
            title: true,
            capacity: true
          }
        }
      },
      orderBy: {
        pickupTime: 'asc'
      }
    });

    if (pendingRides.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No pending rides to process',
        processed: 0
      });
    }

    console.log(`Processing ${pendingRides.length} pending rides`);

    // Call the assign-rides API for each pending ride
    let processedCount = 0;

    for (const ride of pendingRides) {
      try {
        console.log(`Processing ride ${ride.id}...`);

        // Call assign-rides API
        const assignResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/assign-rides`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (assignResponse.ok) {
          const result = await assignResponse.json();
          console.log(`Ride ${ride.id} assignment result:`, result);
          processedCount++;
        } else {
          console.error(`Failed to assign ride ${ride.id}:`, assignResponse.status);
        }

        // Small delay between requests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing ride ${ride.id}:`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${processedCount} out of ${pendingRides.length} pending rides`,
      processed: processedCount,
      total: pendingRides.length
    });

  } catch (error) {
    console.error('Error in process pending rides:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error during ride processing'
    }, { status: 500 });
  }
}