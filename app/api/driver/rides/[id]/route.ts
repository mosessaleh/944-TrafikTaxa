import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
    const rideId = parseInt(params.id);
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

    // Check if driver has access (either assigned, in queue, or has currentRideId set)
    const driverQueue = Array.isArray(ride.driverQueue) ? ride.driverQueue : [];
    const driverRecord = await prisma.comDriver.findUnique({
      where: { id: driver.id },
      select: { currentRideId: true }
    });
    if (ride.driverId !== driver.id && !driverQueue.includes(driver.id) && driverRecord?.currentRideId !== rideId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const response = {
      ok: true,
      data: {
        id: ride.id,
        riderName: ride.riderName,
        pickupAddress: ride.pickupAddress,
        dropoffAddress: ride.dropoffAddress,
        startLatLon: ride.startLatLon,
        endLatLon: ride.endLatLon,
        pickupTime: ride.pickupTime.toISOString(),
        price: ride.price,
        status: ride.status,
        distanceKm: ride.distanceKm,
        durationMin: ride.durationMin,
        vehicleType: ride.vehicleType,
      }
    };

    return NextResponse.json(response);

  } catch (e: any) {
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    return NextResponse.json(errorResponse, { status: 400 });
  }
}