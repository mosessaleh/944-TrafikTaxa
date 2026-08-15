import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createDriverSession, sendLoginNotificationEmail, getClientIp } from '@/lib/session-manager';

const {
  getDriverScheduleSnapshot,
  ensureDriverScheduleTables,
  invalidateDriverScheduleCache
} = require('@/lib/driver-schedule');

const prisma = new PrismaClient();

const DRIVER_CORS_METHODS = 'POST, OPTIONS';
const DRIVER_CORS_HEADERS = 'Content-Type';

function normalizeOriginList(values: Array<string | undefined>): string[] {
  const allowedOrigins = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    const entries = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const entry of entries) {
      try {
        const parsed = new URL(entry);
        allowedOrigins.add(`${parsed.protocol}//${parsed.host}`);
      } catch {
        // Ignore malformed configured origins instead of trusting them.
      }
    }
  }

  return Array.from(allowedOrigins);
}

function normalizeRequestOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getAllowedDriverOrigins(): string[] {
  return normalizeOriginList([
    process.env.ALLOWED_DRIVER_ORIGINS,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL
  ]);
}

function hasTrustedDriverOrigin(request: Request): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const allowedOrigins = getAllowedDriverOrigins();
  const origin = normalizeRequestOrigin(request.headers.get('origin'));
  const referer = normalizeRequestOrigin(request.headers.get('referer'));

  if (!origin && !referer) {
    // Native clients may omit Origin/Referer entirely.
    return true;
  }

  return Boolean(
    (origin && allowedOrigins.includes(origin)) ||
    (referer && allowedOrigins.includes(referer))
  );
}

function getDriverCorsHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': DRIVER_CORS_METHODS,
    'Access-Control-Allow-Headers': DRIVER_CORS_HEADERS,
  };

  const origin = normalizeRequestOrigin(request.headers.get('origin'));
  if (origin) {
    if (process.env.NODE_ENV !== 'production' || getAllowedDriverOrigins().includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    }
  }

  return headers;
}

function jsonWithCors(request: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: getDriverCorsHeaders(request),
  });
}

export async function OPTIONS(request: NextRequest) {
  if (!hasTrustedDriverOrigin(request)) {
    return new Response(null, {
      status: 403,
      headers: getDriverCorsHeaders(request),
    });
  }

  return new Response(null, {
    status: 200,
    headers: getDriverCorsHeaders(request),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!hasTrustedDriverOrigin(request)) {
      return jsonWithCors(request, { error: 'Untrusted origin' }, 403);
    }

    await ensureDriverScheduleTables(prisma);

    const body = await request.json();
    const { username, password, startKM, deviceId, deviceInfo } = body;
    const normalizedUsername = String(username || '').trim();
    const normalizedPassword = String(password || '');
    const parsedStartKM = Number(startKM);

    if (!normalizedUsername || !normalizedPassword || !Number.isFinite(parsedStartKM) || parsedStartKM < 0) {
      return jsonWithCors(request, { error: 'Invalid credentials' }, 401);
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
        drEmail: true,
        car: true,
        rating: true,
        fiveStarCount: true,
        isActive: true,
        bannedUntil: true,
        company: {
          select: {
            comStatus: true
          }
        }
      }
    });
    if (!driver) {
      return jsonWithCors(request, { error: 'Invalid credentials' }, 401);
    }

    // Check password
    const isValidPassword = await bcrypt.compare(normalizedPassword, driver.drPass);
    if (!isValidPassword) {
      return jsonWithCors(request, { error: 'Invalid credentials' }, 401);
    }

    // Check if driver is active
    if (!driver.isActive || !driver.company?.comStatus) {
      return jsonWithCors(request, { error: 'Invalid credentials' }, 401);
    }

    const now = new Date();
    const bannedUntilDate = driver.bannedUntil ? new Date(driver.bannedUntil as any) : null;
    const isBanned = !!(bannedUntilDate && bannedUntilDate > now);

    if (isBanned) {
      const remainingMs = Math.max(0, bannedUntilDate!.getTime() - now.getTime());
      const remainingHours = remainingMs / (1000 * 60 * 60);
      if (remainingHours >= 2) {
        return jsonWithCors(
          request,
          {
            error: 'Driver account is temporarily suspended',
            bannedUntil: bannedUntilDate!.toISOString()
          },
          403
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
      if (parsedStartKM < lastShift.endKM) {
        return jsonWithCors(
          request,
          { error: 'There is something incorrect in the kilometers', message: 'There is something incorrect in the kilometers' },
          400
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

    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || undefined;
    const deviceInfoStr = deviceInfo || `${userAgent || 'Unknown'} / ${deviceId || 'no-device-id'}`;

    const session = await createDriverSession(
      driver.id,
      deviceId,
      deviceInfoStr,
      clientIp,
      userAgent,
      true
    );

    sendLoginNotificationEmail(
      driver.id,
      `${driver.drFname} ${driver.drLname}`,
      (driver as any).drEmail || '',
      deviceInfoStr,
      clientIp,
    );

    return jsonWithCors(request, {
      success: true,
      message: 'Login successful',
      requiresConfirmation: false,
      token: session.accessToken,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      driver: {
        id: driver.id,
        name: `${driver.drFname} ${driver.drLname}`,
        car: driver.car,
        rating: driver.rating ? parseFloat(driver.rating.toString()) : 5.0,
        fiveStarCount: driver.fiveStarCount || 0,
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
    });

  } catch (error: any) {
    console.error('driver/login: error', { message: error?.message });
    return jsonWithCors(request, { error: 'Internal server error' }, 500);
  }
}
