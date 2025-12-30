import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { driverId: number };

    const driver = await prisma.comDriver.findUnique({
      where: { id: decoded.driverId },
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Check if there is an active shift for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeShift = await prisma.driversvagt.findFirst({
      where: {
        drId: decoded.driverId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        endVagt: null // Shift hasn't ended yet
      }
    });

    // Driver is considered online if they have an active shift and isOnline flag is true
    const isOnline = driver.isOnline && !!activeShift;

    const response = {
      isOnline: isOnline,
      isBusy: driver.isBusy,
      currentRideId: driver.currentRideId,
      rideAccepted: driver.rideAccepted,
      hasActiveShift: !!activeShift,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get driver status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { driverId: number };

    const body = await request.json();
    const { online, busy } = body;

    if (online !== undefined && typeof online !== 'boolean') {
      return NextResponse.json({ error: 'Invalid online status' }, { status: 400 });
    }

    if (busy !== undefined && typeof busy !== 'boolean') {
      return NextResponse.json({ error: 'Invalid busy status' }, { status: 400 });
    }

    const updateData: any = {};
    if (online !== undefined) updateData.isOnline = online;
    if (busy !== undefined) updateData.isBusy = busy;

    const updatedDriver = await prisma.comDriver.update({
      where: { id: decoded.driverId },
      data: updateData,
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true },
    });

    // Send real-time update via Socket.IO
    if ((global as any).io) {
      (global as any).io.to(`driver_${decoded.driverId}`).emit('driverStatusUpdate', {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted,
        isOnline: updatedDriver.isOnline,
        timestamp: Date.now()
      });
      console.log(`Sent driverStatusUpdate for driver ${decoded.driverId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Toggle driver online error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}