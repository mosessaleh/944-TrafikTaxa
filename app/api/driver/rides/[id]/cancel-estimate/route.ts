import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Validate request origin for driver API
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  let driver;
  try {
    driver = await requireDriverByJWT(req);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const { id } = await params;
    const rideId = parseInt(id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { vehicleType: true }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (ride.driverId !== driver.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    if (ride.status !== 'DISPATCHED' && ride.status !== 'ONGOING') {
      return NextResponse.json({ ok: false, error: 'Ride is not active' }, { status: 400 });
    }

    const acceptedAt = ride.acceptedAt;
    if (!acceptedAt) {
      return NextResponse.json({ ok: false, error: 'Ride acceptance time not found' }, { status: 400 });
    }

    const now = new Date();
    const timeDiffMs = now.getTime() - acceptedAt.getTime();
    const timeDiffMin = Math.floor(timeDiffMs / (1000 * 60));

    const proximityMap = (global as any).pickupProximitySent as Map<string, any> | undefined;
    const proximityKey = `${rideId}_${driver.id}`;
    const proximityData = proximityMap?.get?.(proximityKey);

    let distanceKm = 0;
    if (proximityData?.startLocation && typeof proximityData.startLocation.lat === 'number' && typeof proximityData.startLocation.lng === 'number') {
      if (Array.isArray(driver.lastLocation) && driver.lastLocation.length >= 2) {
        const lastLat = Number(driver.lastLocation[0]);
        const lastLng = Number(driver.lastLocation[1]);
        if (!Number.isNaN(lastLat) && !Number.isNaN(lastLng)) {
          const currentLocation = { lat: lastLat, lng: lastLng };
          const { calculateDistance } = await import('@/lib/distance');
          distanceKm = calculateDistance(
            proximityData.startLocation.lat,
            proximityData.startLocation.lng,
            currentLocation.lat,
            currentLocation.lng
          );
        }
      }
    }

    const settings = await prisma.settings.findFirst();
    if (!settings) {
      return NextResponse.json({ ok: false, error: 'Settings not found' }, { status: 500 });
    }

    const pickupTime = new Date(ride.pickupTime);
    const hour = pickupTime.getHours();
    const workStartHour = parseInt(settings.workStart.split(':')[0]);
    const workEndHour = parseInt(settings.workEnd.split(':')[0]);
    const isDay = hour >= workStartHour && hour < workEndHour;

    const basePrice = isDay ? settings.dayBase : settings.nightBase;
    const perKmPrice = isDay ? settings.dayPerKm : settings.nightPerKm;
    const perMinPrice = isDay ? settings.dayPerMin : settings.nightPerMin;

    const cost = basePrice + (distanceKm * perKmPrice) + (timeDiffMin * perMinPrice);

    return NextResponse.json({
      ok: true,
      data: {
        cost: Math.round(cost),
        distanceKm: Math.round(distanceKm * 10) / 10,
        timeMin: timeDiffMin
      }
    });
  } catch (e: any) {
    console.error('Cancel estimate error:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}
