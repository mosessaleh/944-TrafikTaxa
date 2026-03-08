import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { signToken } from '@/lib/auth';

const {
  getDriverScheduleSnapshot,
  ensureDriverScheduleTables,
  invalidateDriverScheduleCache
} = require('@/lib/driver-schedule');

const prisma = new PrismaClient();

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    await ensureDriverScheduleTables(prisma);

    const { username, password, startKM } = await request.json();
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');
    const parsedStartKM = Number(startKM);

    console.log('Driver login attempt:', { username: normalizedUsername, hasStartKM: Number.isFinite(parsedStartKM) });

    if (!normalizedUsername || !normalizedPassword || !Number.isFinite(parsedStartKM) || parsedStartKM < 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Find driver by username
    const driver = await prisma.comDriver.findUnique({
      where: { drUsername: normalizedUsername },
      select: {
        id: true,
        drPass: true,
        drUsername: true,
        drFname: true,
        drLname: true,
        car: true,
        rating: true,
        isActive: true,
        bannedUntil: true,
        company: {
          select: {
            comStatus: true
          }
        }
      }
    });
    console.log('Driver found:', !!driver);

    if (!driver) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check password
    const isValidPassword = await bcrypt.compare(normalizedPassword, driver.drPass);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check if driver is active
    console.log('Driver active:', driver.isActive);
    if (!driver.isActive || !driver.company?.comStatus) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const now = new Date();
    const bannedUntilDate = driver.bannedUntil ? new Date(driver.bannedUntil as any) : null;
    const isBanned = !!(bannedUntilDate && bannedUntilDate > now);

    if (isBanned) {
      const remainingMs = Math.max(0, bannedUntilDate!.getTime() - now.getTime());
      const remainingHours = remainingMs / (1000 * 60 * 60);
      if (remainingHours >= 2) {
        return NextResponse.json(
          {
            error: 'Driver account is temporarily suspended',
            bannedUntil: bannedUntilDate!.toISOString()
          },
          {
            status: 403,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          }
        );
      }
    }

    const scheduleSnapshot = await getDriverScheduleSnapshot(prisma, driver.id, new Date());
    const isOutsideSchedule = !scheduleSnapshot?.eligible;

    // Check odometer reading against last recorded endKM
    const lastShift = await prisma.driversvagt.findFirst({
      where: { drId: driver.id },
      orderBy: { date: 'desc' },
    });

    if (lastShift && lastShift.endKM !== null) {
      console.log('Last shift endKM:', lastShift.endKM, 'startKM:', parsedStartKM);
      if (parsedStartKM < lastShift.endKM) {
        return NextResponse.json(
          { error: 'There is something incorrect in the kilometers', message: 'There is something incorrect in the kilometers' },
          {
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          }
        );
      }

    }

    // Check if driver has an active shift (not ended)
    const existingActiveShift = await prisma.driversvagt.findFirst({
      where: {
        drId: driver.id,
        endVagt: null // Shift hasn't ended yet
      },
      orderBy: {
        date: 'desc' // Get the most recent active shift
      }
    });

    let shift;
    if (existingActiveShift) {
      // Use existing active shift
      shift = existingActiveShift;
      console.log(`Using existing active shift for driver ${driver.id}, started at ${shift.startVagt}`);
    } else {
      // Create new driversvagt record
      const now = new Date();
      shift = await prisma.driversvagt.create({
        data: {
          drId: driver.id,
          startVagt: now as any, // DateTime object
          date: now,
          salary: 0, // Will be calculated later
          hourSalary: 0, // Will be calculated later
          startKM: parsedStartKM,
          endKM: parsedStartKM, // Initially same as start
          deffKM: 0, // Initially 0
        },
      });
      console.log(`Created new shift for driver ${driver.id}`);
    }

    const releasedScheduledRidesResult: {
      count: number;
      rideIds: number[];
      rides: Array<{ id: number; pickupTime: string | null }>;
    } = {
      count: 0,
      rideIds: [],
      rides: []
    };

    invalidateDriverScheduleCache(driver.id);

    const token = signToken({ id: driver.id, driverId: driver.id, type: 'driver' });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      requiresConfirmation: false,
      token: token,
      driver: {
        id: driver.id,
        name: `${driver.drFname} ${driver.drLname}`,
        car: driver.car,
        rating: driver.rating ? parseFloat(driver.rating.toString()) : 5.0,
      },
      shiftId: shift.id,
      shiftStartTime: shift.startVagt ? shift.startVagt.toISOString() : null,
      bannedUntil: bannedUntilDate ? bannedUntilDate.toISOString() : null,
      restrictedOffersUntil: isBanned ? bannedUntilDate!.toISOString() : null,
      restrictedOffers: Boolean(isBanned),
      schedule: scheduleSnapshot,
      loginPolicy: {
        outsideSchedule: isOutsideSchedule,
        redistributionPolicy: {
          enabled: false
        },
        releasedScheduledRides: releasedScheduledRidesResult
      }
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Driver login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}
