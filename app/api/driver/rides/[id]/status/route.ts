import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireDriverByApiKey } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';

const StatusUpdateSchema = z.object({
  status: z.enum(['accepted', 'picked_up', 'completed', 'cancelled'])
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  console.log(`📨 Driver ride status update request received at ${new Date().toISOString()}`);
  console.log(`Request headers:`, Object.fromEntries(req.headers.entries()));

  // Validate request origin for driver API
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    console.log(`❌ Origin validation failed: ${originCheck.reason}`);
    const errorResponse = { ok: false, error: 'Invalid request origin' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status: 403 });
  }
  console.log(`✅ Origin validation passed`);

  let driver;
  try {
    driver = await requireDriverByApiKey(req);
    console.log(`✅ Driver authenticated: ${driver.id} (${driver.drUsername})`);
  } catch (e: any) {
    console.log(`❌ Driver authentication failed: ${e.message}`);
    const errorResponse = { ok: false, error: 'Forbidden' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status: e?.status || 403 });
  }

  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      const errorResponse = { ok: false, error: 'Invalid ride ID' };
      console.log(`📤 Error response sent to driver server:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { status } = StatusUpdateSchema.parse(await req.json());

    console.log(`🔍 Fetching ride ${rideId} details`);
    const ride = await prisma.ride.findUnique({
      where: { id: rideId }
    });

    if (!ride) {
      console.log(`❌ Ride ${rideId} not found`);
      const errorResponse = { ok: false, error: 'Ride not found' };
      console.log(`📤 Error response sent to driver server:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 404 });
    }

    console.log(`✅ Ride ${rideId} found - current status: ${ride.status}, driverId: ${ride.driverId}`);

    // Check if driver is assigned to this ride
    if (ride.driverId !== driver.id) {
      console.log(`❌ Access denied: driver ${driver.id} not assigned to ride ${rideId} (assigned to ${ride.driverId})`);
      const errorResponse = { ok: false, error: 'Access denied - you are not assigned to this ride' };
      console.log(`📤 Error response sent to driver server:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 403 });
    }

    console.log(`✅ Driver ${driver.id} authorized for ride ${rideId}`);

    // Map mobile app status to database status
    let dbStatus: string;
    let explanation: string;
    let updateData: any = { status };

    switch (status) {
      case 'accepted':
        dbStatus = 'ONGOING';
        explanation = 'Driver has accepted the ride and is on the way';
        updateData.acceptedAt = new Date();
        break;
      case 'picked_up':
        dbStatus = 'PICKED_UP';
        explanation = 'Passenger has been picked up';
        updateData.pickedAt = new Date();
        break;
      case 'completed':
        dbStatus = 'COMPLETED';
        explanation = 'Ride completed successfully';
        updateData.droppedAt = new Date();
        break;
      case 'cancelled':
        dbStatus = 'CONFIRMED';
        explanation = 'Ride cancelled by driver - available for reassignment';
        updateData.driverId = null; // Clear driver assignment for reassignment
        break;
    }

    updateData.status = dbStatus;
    updateData.explanation = explanation;

    console.log(`🚚 Updating ride ${rideId} status to ${dbStatus}`);

    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: updateData
    });

    // If ride is completed or cancelled, free up the driver
    if (status === 'completed' || status === 'cancelled') {
      const updateData: any = {
        currentRideId: null,
        rideAccepted: null,
        isBusy: false
      };

      // Deduct rating for cancelling after accepting
      if (status === 'cancelled') {
        updateData.rating = {
          decrement: 0.05 // Deduct 0.05 for cancelling after accepting
        };
        console.log(`⚠️ Deducted 0.05 from driver ${driver.id} rating for cancelling`);
      }

      await prisma.comDriver.update({
        where: { id: driver.id },
        data: updateData
      });
      console.log(`✅ Driver ${driver.id} freed up`);
    }

    console.log(`✅ Ride ${rideId} status updated successfully to ${dbStatus}`);

    const successResponse = {
      ok: true,
      message: `Ride status updated to ${status}`,
      ride: {
        id: updatedRide.id,
        status: status,
        updatedAt: new Date().toISOString()
      }
    };

    console.log(`📤 Success response sent to driver:`, successResponse);
    return NextResponse.json(successResponse);

  } catch (e: any) {
    console.error('❌ Error updating ride status:', e);
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    console.log(`📤 Error response sent to driver server:`, errorResponse);
    return NextResponse.json(errorResponse, { status: 400 });
  }
}