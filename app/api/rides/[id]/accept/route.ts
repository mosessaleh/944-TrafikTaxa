import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireDriverByApiKey } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';

const AcceptRideSchema = z.object({
  driverId: z.number().int().positive('Invalid driver ID'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  console.log(`📨 Ride accept request received at ${new Date().toISOString()}`);

  // Validate request origin for driver API
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    console.log(`❌ Origin validation failed: ${originCheck.reason}`);
    return NextResponse.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }
  console.log(`✅ Origin validation passed`);

  let driver;
  try {
    driver = await requireDriverByApiKey(req);
    console.log(`✅ Driver authenticated: ${driver.id} (${driver.drUsername})`);
  } catch (e: any) {
    console.log(`❌ Driver authentication failed: ${e.message}`);
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    const { driverId } = AcceptRideSchema.parse(await req.json());

    // Verify driver ID matches authenticated driver
    if (driverId !== driver.id) {
      console.log(`❌ Driver ID mismatch: provided ${driverId}, authenticated ${driver.id}`);
      return NextResponse.json({ ok: false, error: 'Driver ID mismatch' }, { status: 403 });
    }

    console.log(`🔍 Fetching ride ${rideId} details`);
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { vehicleType: true }
    });

    if (!ride) {
      console.log(`❌ Ride ${rideId} not found`);
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    // Check if ride is still available (not accepted by another driver)
    if (ride.driverId && ride.driverId !== driver.id) {
      console.log(`❌ Ride ${rideId} already assigned to driver ${ride.driverId}`);
      return NextResponse.json({ ok: false, error: 'Ride already accepted by another driver' }, { status: 409 });
    }

    // Check if driver has a car assigned
    if (!driver.car) {
      console.log(`❌ Driver ${driver.id} has no car assigned`);
      return NextResponse.json({ ok: false, error: 'No car assigned to driver' }, { status: 400 });
    }

    console.log(`✅ Ride ${rideId} available for acceptance`);

    // Update ride with driver assignment
    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId: driver.id,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: { vehicleType: true }
    });

    // Update driver status
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: {
        currentRideId: rideId,
        rideAccepted: true,
        isBusy: true,
      }
    });

    console.log(`✅ Ride ${rideId} accepted by driver ${driver.id}`);

    const successResponse = {
      ok: true,
      message: 'Ride accepted successfully',
      ride: {
        id: updatedRide.id,
        status: updatedRide.status,
        driverId: updatedRide.driverId,
        acceptedAt: updatedRide.acceptedAt,
      }
    };

    console.log(`📤 Success response sent to driver:`, successResponse);
    return NextResponse.json(successResponse);

  } catch (e: any) {
    console.error('❌ Error accepting ride:', e);
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    console.log(`📤 Error response sent to driver:`, errorResponse);
    return NextResponse.json(errorResponse, { status: 400 });
  }
}