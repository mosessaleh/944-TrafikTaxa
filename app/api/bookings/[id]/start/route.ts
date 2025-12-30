import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verify } from 'jsonwebtoken';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    // Verify the driver token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);

    let driver;
    try {
      const decoded: any = verify(token, process.env.AUTH_SECRET || 'change_me_dev_secret');

      if (!decoded.driverId || decoded.type !== 'driver') {
        return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
      }

      driver = await prisma.comDriver.findUnique({
        where: { id: decoded.driverId },
      });

      if (!driver) {
        return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
      }
    } catch (error) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // Check if ride exists and is assigned to this driver
    const ride = await prisma.ride.findUnique({
      where: { id: rideId }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (ride.driverId !== driver.id) {
      return NextResponse.json({ ok: false, error: 'Ride not assigned to this driver' }, { status: 403 });
    }

    if (ride.status !== 'ONGOING') {
      return NextResponse.json({ ok: false, error: 'Ride is not in a state that can be started' }, { status: 400 });
    }

    // Update ride status to IN_PROGRESS
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'IN_PROGRESS',
        pickedAt: new Date()
      }
    });

    return NextResponse.json({
      ok: true,
      message: 'Ride started successfully'
    });

  } catch (e: any) {
    console.error('Error starting ride:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}