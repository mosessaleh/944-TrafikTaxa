import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const driverId = parseInt(params.id);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    const body = await request.json();
    const { busy } = body;

    if (typeof busy !== 'boolean') {
      return NextResponse.json({ error: 'Invalid busy status' }, { status: 400 });
    }

    // Update driver status
    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: { isBusy: busy },
      select: { id: true, isBusy: true, currentRideId: true, rideAccepted: true },
    });

    // Send real-time update via Socket.IO
    if ((global as any).io) {
      (global as any).io.to(`driver_${driverId}`).emit('driverStatusUpdate', {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted,
        timestamp: Date.now()
      });
      console.log(`Sent driverStatusUpdate for driver ${driverId} (admin toggle)`);
    }

    return NextResponse.json({ ok: true, data: updatedDriver });
  } catch (error) {
    console.error('Toggle driver busy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}