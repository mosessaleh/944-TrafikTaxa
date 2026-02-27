import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const {
  ensureDriverScheduleTables,
  getDriverScheduleSnapshot,
  getDriverScheduleSuggestions
} = require('@/lib/driver-schedule');

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    await ensureDriverScheduleTables(prisma);

    console.log('Analytics API called');
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(
      token,
      process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret'
    ) as { driverId: number };
    console.log('Decoded driverId:', decoded.driverId);

    const driverId = decoded.driverId;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // day, week, month

    // Calculate date range
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

    // Get completed rides for the driver in the period
    const rides = await prisma.ride.findMany({
      where: {
        driverId: driverId,
        status: 'COMPLETED',
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate statistics
    const totalRides = rides.length;
    const totalEarnings = rides.reduce((sum, ride) => sum + (ride.price || 0), 0);
    const averageRidePrice = totalRides > 0 ? totalEarnings / totalRides : 0;
    const totalDistance = rides.reduce((sum, ride) => sum + (ride.distanceKm || 0), 0);
    const averageDistance = totalRides > 0 ? totalDistance / totalRides : 0;

    // Group rides by day for chart data
    const dailyStats = rides.reduce((acc: any, ride) => {
      const date = ride.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { rides: 0, earnings: 0 };
      }
      acc[date].rides += 1;
      acc[date].earnings += ride.price || 0;
      return acc;
    }, {});

    // Convert to array for charts
    const chartData = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      rides: stats.rides,
      earnings: stats.earnings,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top pickup areas
    const pickupAreas = rides.reduce((acc: any, ride) => {
      if (ride.pickupAddress) {
        const area = ride.pickupAddress.split(',')[0]; // Simple area extraction
        acc[area] = (acc[area] || 0) + 1;
      }
      return acc;
    }, {});

    const topPickupAreas = Object.entries(pickupAreas)
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([area, count]) => ({ area, count }));

    // Hourly distribution
    const hourlyStats = rides.reduce((acc: any, ride) => {
      const hour = ride.createdAt.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      rides: hourlyStats[hour] || 0,
    }));

    // Performance metrics
    const acceptanceRate = 85; // This would need more complex calculation
    const averageRating = 4.2; // This would come from ratings system
    const completionRate = totalRides > 0 ? (rides.filter(r => r.status === 'COMPLETED').length / totalRides) * 100 : 0;

    const scheduleSnapshot = await getDriverScheduleSnapshot(prisma, driverId, now);
    const scheduleSuggestions = await getDriverScheduleSuggestions(prisma, driverId, {
      now,
      daysBack: 42
    });

    // If no rides, return sample data for demo
    if (totalRides === 0) {
      const sampleAnalytics = {
        period,
        summary: {
          totalRides: 15,
          totalEarnings: 2250,
          averageRidePrice: 150,
          totalDistance: 450,
          averageDistance: 30,
          acceptanceRate: 85,
          averageRating: 4.2,
          completionRate: 95,
        },
        charts: {
          daily: [
            { date: '01', rides: 3, earnings: 450 },
            { date: '02', rides: 5, earnings: 750 },
            { date: '03', rides: 2, earnings: 300 },
            { date: '04', rides: 4, earnings: 600 },
            { date: '05', rides: 1, earnings: 150 },
          ],
          hourly: Array.from({ length: 24 }, (_, hour) => ({
            hour: `${hour}:00`,
            rides: Math.floor(Math.random() * 5),
          })),
        },
        insights: {
          topPickupAreas: [
            { area: 'City Center', count: 8 },
            { area: 'Airport', count: 4 },
            { area: 'Train Station', count: 3 },
          ],
          peakHours: [
            { hour: '08:00', rides: 4 },
            { hour: '17:00', rides: 3 },
            { hour: '12:00', rides: 2 },
          ],
          busiestDay: { date: '02', rides: 5, earnings: 750 },
        },
        schedule: {
          current: scheduleSnapshot,
          suggestions: scheduleSuggestions
        }
      };
      return NextResponse.json(sampleAnalytics);
    }

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
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
