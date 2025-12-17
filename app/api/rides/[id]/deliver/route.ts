import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    // Get the ride to find the driver
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { driverId: true, status: true }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (!ride.driverId) {
      return NextResponse.json({ ok: false, error: 'No driver assigned to this ride' }, { status: 400 });
    }

    // Update the ride status to COMPLETED
    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'COMPLETED',
        droppedAt: new Date()
      },
    });

    // Update the driver to clear current ride
    await prisma.comDriver.update({
      where: { id: ride.driverId },
      data: {
        currentRideId: null,
        isBusy: false
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Ride delivered successfully',
      ride: { id: updatedRide.id, status: updatedRide.status, droppedAt: updatedRide.droppedAt }
    });

  } catch (e: any) {
    console.error('Error delivering ride:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}