import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';

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

    // Default period: from 26th of last month to 25th of current month or current date if before 25th
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let defaultStart: Date;
    let defaultEnd: Date;

    if (currentDay < 25) {
      // If before 25th, show from 26th of last month to current date
      defaultStart = new Date(currentYear, currentMonth - 1, 26);
      defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else {
      // Show from 26th of last month to 25th of current month
      defaultStart = new Date(currentYear, currentMonth - 1, 26);
      defaultEnd = new Date(currentYear, currentMonth, 25, 23, 59, 59);
    }

    const start = startDate ? new Date(startDate) : defaultStart;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : defaultEnd;

    const rides = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['COMPLETED', 'CANCELED'] },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
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
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    });
  } catch (e: any) {
    console.error('Error fetching driver history:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}
