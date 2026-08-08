import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verify, TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import { checkTokenBlacklist, getAuthSecret } from '@/lib/auth';
import { trackIpChange, getClientIp } from '@/lib/session-manager';

const {
  getDriverScheduleSnapshot,
  ensureDriverScheduleTables
} = require('@/lib/driver-schedule');

const prisma = new PrismaClient();
const JWT_SECRET = getAuthSecret();

function verifyDriverToken(authHeader: string | null): Promise<{ driverId?: number; id?: number; type?: string; jti?: string }> {
  return (async () => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw Object.assign(new Error('Missing or invalid authorization header'), { status: 401 });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verify(token, JWT_SECRET) as { driverId?: number; id?: number; type?: string; jti?: string };

      // Check token blacklist
      const jti = decoded?.jti;
      if (jti) {
        const isBlacklisted = await checkTokenBlacklist(jti);
        if (isBlacklisted) {
          throw Object.assign(new Error('Token has been revoked'), { status: 401 });
        }
      }

      return decoded;
    } catch (error: any) {
      if (error.status) throw error;
      if (error instanceof TokenExpiredError) {
        throw Object.assign(new Error('Token expired'), { status: 401 });
      }
      if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
        throw Object.assign(new Error('Invalid token'), { status: 401 });
      }
      throw error;
    }
  })();
}

export async function GET(request: NextRequest) {
  try {
    await ensureDriverScheduleTables(prisma);

    let decoded: { driverId?: number; id?: number; type?: string; jti?: string };

    try {
      const authHeader = request.headers.get('authorization');
      decoded = await verifyDriverToken(authHeader);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: error.status || 401 });
    }

    const driverId = Number(decoded?.driverId ?? decoded?.id);
    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Track IP change for anomaly detection
    if (decoded.jti) {
      const clientIp = getClientIp(request);
      await trackIpChange(decoded.jti, clientIp);
    }

    const driver = await (prisma as any).comDriver.findUnique({
      where: { id: driverId },
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true, bannedUntil: true, rating: true },
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    // Check if there is an active shift (not ended yet)
    const activeShift = await prisma.driversvagt.findFirst({
      where: {
        drId: driverId,
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
        driverId,
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

    const schedule = await getDriverScheduleSnapshot(prisma, driverId, new Date());

    const now = new Date();
    const restrictedOffers = Boolean(driver.bannedUntil && driver.bannedUntil > now);
    const restrictedOffersUntil = restrictedOffers ? driver.bannedUntil!.toISOString() : null;

    const response = {
      isOnline: isOnline,
      isBusy: driver.isBusy,
      currentRideId: driver.currentRideId,
      rideAccepted: driver.rideAccepted,
      bannedUntil: driver.bannedUntil ? driver.bannedUntil.toISOString() : null,
      restrictedOffers,
      restrictedOffersUntil,
      hasActiveShift: !!activeShift,
      shiftStartTime: activeShift && activeShift.startVagt ? activeShift.startVagt.toISOString() : null,
      totalRidesToday,
      earningsToday,
      rating: driver.rating ? parseFloat(driver.rating.toString()) : 5.0,
      schedule,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get driver status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDriverScheduleTables(prisma);

    let decoded: { driverId?: number; id?: number; type?: string; jti?: string };

    try {
      const authHeader = request.headers.get('authorization');
      decoded = await verifyDriverToken(authHeader);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: error.status || 401 });
    }

    const driverId = Number(decoded?.driverId ?? decoded?.id);
    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Track IP change for anomaly detection
    if (decoded.jti) {
      const clientIp = getClientIp(request);
      await trackIpChange(decoded.jti, clientIp);
    }

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
      where: { id: driverId },
      data: updateData,
      select: { isOnline: true, isBusy: true, currentRideId: true, rideAccepted: true, bannedUntil: true },
    });

    // Send real-time update via Socket.IO
    if ((global as any).io) {
      const now = new Date();
      const restrictedOffers = Boolean(updatedDriver.bannedUntil && updatedDriver.bannedUntil > now);
      const restrictedOffersUntil = restrictedOffers ? updatedDriver.bannedUntil!.toISOString() : null;
      (global as any).io.to(`driver_${driverId}`).emit('driverStatusUpdate', {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted,
        isOnline: updatedDriver.isOnline,
        bannedUntil: updatedDriver.bannedUntil ? updatedDriver.bannedUntil.toISOString() : null,
        restrictedOffers,
        restrictedOffersUntil,
        timestamp: Date.now()
      });
      console.log(`Sent driverStatusUpdate for driver ${driverId}`);
    }

    const schedule = await getDriverScheduleSnapshot(prisma, driverId, new Date());

    return NextResponse.json({
      success: true,
      schedule,
      scheduleWarning: online === true && !schedule?.eligible
        ? {
            code: 'OUTSIDE_SCHEDULE',
            message: 'Driver is outside configured work schedule. Online mode is still allowed.'
          }
        : null
    });
  } catch (error) {
    console.error('Toggle driver online error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
