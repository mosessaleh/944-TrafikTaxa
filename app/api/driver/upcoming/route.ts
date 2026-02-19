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
    const now = new Date();

    const rides = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        scheduled: true,
        pickupTime: { gte: now },
        status: { notIn: ['CANCELED', 'COMPLETED', 'REFUNDED'] }
      },
      select: {
        id: true,
        pickupAddress: true,
        dropoffAddress: true,
        stopAddress: true,
        pickupTime: true,
        price: true,
        distanceKm: true,
        durationMin: true,
        status: true,
        vehicleTypeId: true,
        startLatLon: true,
        stopLatLon: true,
        endLatLon: true,
        riderName: true
      },
      orderBy: {
        pickupTime: 'asc'
      }
    });

    return NextResponse.json({ ok: true, rides });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}
