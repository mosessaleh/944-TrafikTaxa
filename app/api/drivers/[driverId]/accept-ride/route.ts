import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const AcceptRideSchema = z.object({
  rideId: z.number().int().positive('Invalid ride ID'),
});

export async function POST(req: NextRequest, { params }: { params: { driverId: string } }) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    const { rideId } = AcceptRideSchema.parse(await req.json());

    // Check if ride exists and is in correct state
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    // Check if driver exists and has this ride assigned
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        car: true,
        currentRideId: true,
        rideAccepted: true
      }
    });

    if (!driver) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    if (driver.currentRideId !== rideId) {
      return NextResponse.json({ ok: false, error: 'Ride not assigned to this driver' }, { status: 400 });
    }

    if (driver.rideAccepted === 1) {
      return NextResponse.json({ ok: false, error: 'Ride already accepted' }, { status: 400 });
    }

    // Update the ride with driver info and change status to ONGOING
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId: driverId,
        car: driver.car,
        status: 'ONGOING',
        acceptedAt: new Date()
      },
    });

    // Update the driver to mark ride as accepted and set busy
    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        rideAccepted: 1,
        isBusy: true
      },
    });

    console.log(`accept-ride: Driver ${driverId} accepted ride ${rideId}, status changed to ONGOING`);

    return NextResponse.json({
      ok: true,
      message: 'Ride accepted successfully',
      driver: {
        id: updatedDriver.id,
        currentRideId: updatedDriver.currentRideId,
        rideAccepted: updatedDriver.rideAccepted,
        isBusy: updatedDriver.isBusy
      }
    });

  } catch (e: any) {
    console.error('Error accepting ride:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}