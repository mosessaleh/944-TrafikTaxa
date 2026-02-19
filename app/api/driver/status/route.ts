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
  const decoded = jwt.verify(
    token,
    process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret'
  ) as { driverId: number };

    const driver = await (prisma as any).comDriver.findUnique({
      where: { id: decoded.driverId },
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true, bannedUntil: true, rating: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Check if there is an active shift (not ended yet)
    const activeShift = await prisma.driversvagt.findFirst({
      where: {
        drId: decoded.driverId,
        endVagt: null // Shift hasn't ended yet
      },
      orderBy: {
        date: 'desc' // Get the most recent active shift
      }
    });

    // Driver is considered online if they have an active shift and isOnline flag is true
    const isOnline = driver.isOnline && !!activeShift;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStats = await prisma.ride.aggregate({
      where: {
        driverId: decoded.driverId,
        status: 'COMPLETED',
        OR: [
          {
            droppedAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          {
            droppedAt: null,
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
        ],
      },
      _count: { _all: true },
      _sum: { price: true },
    });

    const totalRidesToday = todayStats._count?._all ?? 0;
    const earningsToday = todayStats._sum?.price ?? 0;

    const response = {
      isOnline: isOnline,
      isBusy: driver.isBusy,
      currentRideId: driver.currentRideId,
      rideAccepted: driver.rideAccepted,
      bannedUntil: driver.bannedUntil ? driver.bannedUntil.toISOString() : null,
      hasActiveShift: !!activeShift,
      shiftStartTime: activeShift && activeShift.startVagt ? activeShift.startVagt.toISOString() : null,
      totalRidesToday,
      earningsToday,
      rating: driver.rating ? parseFloat(driver.rating.toString()) : 5.0,
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
  const decoded = jwt.verify(
    token,
    process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret'
  ) as { driverId: number };

    const body = await request.json();
    const { online, busy, busyMode } = body;

    if (online !== undefined && typeof online !== 'boolean') {
      return NextResponse.json({ error: 'Invalid online status' }, { status: 400 });
    }

    if (busy !== undefined && typeof busy !== 'boolean') {
      return NextResponse.json({ error: 'Invalid busy status' }, { status: 400 });
    }

    if (busyMode !== undefined && busyMode !== null && busyMode !== 'manual' && busyMode !== 'auto') {
      return NextResponse.json({ error: 'Invalid busy mode' }, { status: 400 });
    }

    const updateData: any = {};
    if (online !== undefined) updateData.isOnline = online;
    if (busy !== undefined) updateData.isBusy = busy;
    if (busyMode !== undefined) updateData.busyMode = busyMode;

    const updatedDriver = await (prisma as any).comDriver.update({
      where: { id: decoded.driverId },
      data: updateData,
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true, bannedUntil: true },
    });

    // Send real-time update via Socket.IO
    if ((global as any).io) {
      (global as any).io.to(`driver_${decoded.driverId}`).emit('driverStatusUpdate', {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted,
        isOnline: updatedDriver.isOnline,
        bannedUntil: updatedDriver.bannedUntil ? updatedDriver.bannedUntil.toISOString() : null,
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
