import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const AcceptRideSchema = z.object({
  driverId: z.number().int().positive('Invalid driver ID'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    const { driverId } = AcceptRideSchema.parse(await req.json());

    // Check if ride exists and is available
    const ride = await prisma.ride.findUnique({
      where: { id: rideId }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (ride.driverId) {
      return NextResponse.json({ ok: false, error: 'Ride already assigned to another driver' }, { status: 409 });
    }

    if (ride.status !== 'CONFIRMED') {
      return NextResponse.json({ ok: false, error: 'Ride is not available for acceptance' }, { status: 400 });
    }

    // Check if driver exists and is available
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId }
    });

    if (!driver) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    if (driver.currentRideId !== rideId) {
      return NextResponse.json({ ok: false, error: 'Driver is not assigned to this ride' }, { status: 403 });
    }

    // Assign ride to driver
    console.log(`[DEBUG] Updating booking ${rideId} status to ONGOING for driver acceptance`);
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId: driverId,
        car: driver.car, // Add car plate number
        status: 'ONGOING'
      }
    });
    console.log(`[DEBUG] Booking ${rideId} status updated to ONGOING`);

    // Update driver status
    await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        currentRideId: rideId, // Ensure currentRideId is set
        rideAccepted: 1, // Accepted
        isBusy: true
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Ride accepted successfully'
    });

  } catch (e: any) {
    console.error('Error accepting ride:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}