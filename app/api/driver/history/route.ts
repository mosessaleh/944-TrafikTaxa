import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';

const COMPLETED_HISTORY_STATUSES = ['COMPLETED', 'CANCELED'] as const;
const RECENT_RIDE_STATUSES = [
  'DISPATCHED',
  'ONGOING',
  'PICKED_UP',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

export async function GET(req: NextRequest) {
  let driver;
  try {
    driver = await requireDriverByJWT(req);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const allDrivers = searchParams.get('all') === 'true';
    const includeActive = searchParams.get('includeActive') === 'true';
    const historyStatuses = includeActive ? RECENT_RIDE_STATUSES : COMPLETED_HISTORY_STATUSES;

    const start = startDate ? new Date(`${startDate}T00:00:00.000`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;

    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      return NextResponse.json({ ok: false, error: 'Invalid date range' }, { status: 400 });
    }

    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (start) createdAtFilter.gte = start;
    if (end) createdAtFilter.lte = end;
    const dateFilter = Object.keys(createdAtFilter).length > 0
      ? { createdAt: createdAtFilter }
      : {};

    const rides = await prisma.ride.findMany({
      where: {
        ...(allDrivers ? {} : { driverId: driver.id }),
        status: { in: [...historyStatuses] },
        ...dateFilter,
      },
      select: {
        id: true,
        userId: true,
        pickupAddress: true,
        dropoffAddress: true,
        stopAddress: true,
        scheduled: true,
        pickupTime: true,
        distanceKm: true,
        durationMin: true,
        price: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        acceptedAt: true,
        pickedAt: true,
        droppedAt: true,
        vehicleTypeId: true,
        cancellationReason: true,
        canceledBy: true,
        explanation: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalRides = rides.length;
    const totalAmount = rides.reduce((sum, ride) => sum + (ride.price || 0), 0);

    return NextResponse.json({
      ok: true,
      rides,
      summary: {
        totalRides,
        totalAmount,
        period: {
          start: start ? start.toISOString() : null,
          end: end ? end.toISOString() : null,
        },
      },
    });
  } catch (e: any) {
    console.error('Error fetching driver history:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}
