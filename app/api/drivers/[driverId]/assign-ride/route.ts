import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const AssignRideSchema = z.object({
  rideId: z.number().int().positive('Invalid ride ID'),
});

export async function POST(req: NextRequest, { params }: { params: { driverId: string } }) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    const { rideId } = AssignRideSchema.parse(await req.json());

    // Check if ride exists
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    // Check if driver exists
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    // Update the ride with the driver
    await prisma.ride.update({
      where: { id: rideId },
      data: { driverId: driverId },
    });

    // Update the driver with the current ride
    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: { currentRideId: rideId, rideAccepted: 0 },
    });
    console.log(`assign-ride: Assigned ride ${rideId} to driver ${driverId} with rideAccepted: 0`);

    return NextResponse.json({
      ok: true,
      message: 'Ride assigned to driver successfully',
      driver: { id: updatedDriver.id, currentRideId: updatedDriver.currentRideId }
    });

  } catch (e: any) {
    console.error('Error assigning ride to driver:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}