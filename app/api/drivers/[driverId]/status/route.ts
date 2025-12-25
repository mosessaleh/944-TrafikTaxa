import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { driverId: string } }
) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        drFname: true,
        drLname: true,
        isOnline: true,
        isBusy: true,
        currentRideId: true,
        rideAccepted: true,
        rating: true,
        car: true,
        lastLocation: true,
      }
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      driver
    });

  } catch (error) {
    console.error('Error fetching driver status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}