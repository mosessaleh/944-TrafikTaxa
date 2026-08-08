import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verify, TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import { checkTokenBlacklist, getAuthSecret } from '@/lib/auth';

const {
  ensureDriverScheduleTables,
  getDriverScheduleSnapshot,
  getDriverScheduleSuggestions
} = require('@/lib/driver-schedule');

const prisma = new PrismaClient();
const JWT_SECRET = getAuthSecret();

export async function GET(request: NextRequest) {
  try {
    await ensureDriverScheduleTables(prisma);

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: { driverId?: number; id?: number; type?: string; jti?: string };

    try {
      decoded = verify(
        token,
        JWT_SECRET
      ) as { driverId?: number; id?: number; type?: string; jti?: string };
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      throw error;
    }

    const driverId = Number(decoded?.driverId ?? decoded?.id);
    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jti = decoded?.jti;
    if (jti) {
      const isBlacklisted = await checkTokenBlacklist(jti);
      if (isBlacklisted) {
        return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const [allRides, completedRides, driver] = await Promise.all([
      prisma.ride.findMany({
        where: { driverId, createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ride.findMany({
        where: { driverId, status: 'COMPLETED', createdAt: { gte: startDate } },
        orderBy: { createdAt: 'desc' },
      }),
      (prisma as any).comDriver.findUnique({
        where: { id: driverId },
        select: { rating: true, acceptedRides: true, rejectedRides: true, acceptedStreak: true },
      }),
    ]);

    const totalRides = allRides.length;
    const acceptedCount = driver?.acceptedRides || 0;
    const rejectedCount = driver?.rejectedRides || 0;
    const totalDecisions = acceptedCount + rejectedCount;
    const acceptedStreak = driver?.acceptedStreak || 0;

    const totalEarnings = completedRides.reduce((sum, ride) => sum + (ride.price || 0), 0);
    const averageRidePrice = completedRides.length > 0 ? totalEarnings / completedRides.length : 0;
    const totalDistance = completedRides.reduce((sum, ride) => sum + (ride.distanceKm || 0), 0);
    const averageDistance = completedRides.length > 0 ? totalDistance / completedRides.length : 0;

    const acceptanceRate = totalDecisions > 0 ? Math.round((acceptedCount / totalDecisions) * 100) : 0;
    const averageRating = driver?.rating ? parseFloat(driver.rating.toString()) : 0;
    const completionRate = totalRides > 0 ? Math.round((completedRides.length / totalRides) * 100) : 0;

    const dailyStats = completedRides.reduce((acc: any, ride) => {
      const date = ride.createdAt.toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { rides: 0, earnings: 0 };
      acc[date].rides += 1;
      acc[date].earnings += ride.price || 0;
      return acc;
    }, {});

    const chartData = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      rides: stats.rides,
      earnings: stats.earnings,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const pickupAreas = completedRides.reduce((acc: any, ride) => {
      if (ride.pickupAddress) {
        const area = ride.pickupAddress.split(',')[0];
        acc[area] = (acc[area] || 0) + 1;
      }
      return acc;
    }, {});

    const topPickupAreas = Object.entries(pickupAreas)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([area, count]) => ({ area, count }));

    const hourlyStats = completedRides.reduce((acc: any, ride) => {
      const hour = ride.createdAt.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      rides: hourlyStats[hour] || 0,
    }));

    const scheduleSnapshot = await getDriverScheduleSnapshot(prisma, driverId, now);
    const scheduleSuggestions = await getDriverScheduleSuggestions(prisma, driverId, {
      now,
      daysBack: 42
    });

    const analytics = {
      period,
      summary: {
        totalRides,
        totalEarnings,
        averageRidePrice,
        totalDistance,
        averageDistance,
        acceptanceRate,
        averageRating,
        completionRate,
        acceptedStreak,
      },
      charts: {
        daily: chartData,
        hourly: hourlyData,
      },
      insights: {
        topPickupAreas,
        peakHours: hourlyData.filter(h => h.rides > 0).sort((a, b) => b.rides - a.rides).slice(0, 3),
        busiestDay: chartData.length > 0 ? chartData.reduce((max, day) => day.rides > max.rides ? day : max) : null,
      },
      schedule: {
        current: scheduleSnapshot,
        suggestions: scheduleSuggestions
      }
    };

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('driver/analytics: error', { message: error?.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
