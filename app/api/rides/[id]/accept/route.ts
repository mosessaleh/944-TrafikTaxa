import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { requireAuthSecret } from '@/lib/security-config';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, requireAuthSecret('rides accept route')) as { driverId: number };

    const driver = await prisma.comDriver.findUnique({
      where: { id: decoded.driverId },
      select: {
        id: true,
        drFname: true,
        drLname: true,
        car: true,
        isActive: true,
        currentRideId: true,
        isBusy: true,
      },
    });

    if (!driver || !driver.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if driver is available (not busy and no current ride)
    if (driver.currentRideId !== null || driver.isBusy) {
      return NextResponse.json({ error: 'Driver is currently busy with another ride' }, { status: 409 });
    }

    const rideId = parseInt(params.id);
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride || ride.driverId) {
      return NextResponse.json({ error: 'Ride not available' }, { status: 400 });
    }

    // Update ride
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        driverId: driver.id,
        car: driver.car, // Assume driver has car
        status: 'DISPATCHED',
        explanation: `${driver.drFname} ${driver.drLname} with his car ${driver.car} on their way.`,
        acceptedAt: new Date(),
      },
    });

    // Update driver
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: {
        currentRideId: rideId,
        rideAccepted: 1,
        isBusy: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Accept ride error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}