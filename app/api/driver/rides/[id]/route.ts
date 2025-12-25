import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  console.log(`📨 Driver ride fetch request received at ${new Date().toISOString()}`);

  // Validate request origin for driver API
  const originCheck = validateDriverApiOrigin(req);
  if (!originCheck.ok) {
    console.log(`❌ Origin validation failed: ${originCheck.reason}`);
    return NextResponse.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }
  console.log(`✅ Origin validation passed`);

  let driver;
  try {
    driver = await requireDriverByJWT(req);
    console.log(`✅ Driver authenticated: ${driver.id} (${driver.drUsername})`);
  } catch (e: any) {
    console.log(`❌ Driver authentication failed: ${e.message}`);
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    console.log(`🔍 Fetching ride ${rideId} for driver ${driver.id} (${driver.drUsername})`);
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { vehicleType: true }
    });

    if (!ride) {
      console.log(`❌ Ride ${rideId} not found`);
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    console.log(`✅ Ride found: id=${ride.id}, driverId=${ride.driverId}, driverQueue=${JSON.stringify(ride.driverQueue)}`);

    // Check if driver has access (either assigned, in queue, or has currentRideId set)
    const driverQueue = Array.isArray(ride.driverQueue) ? ride.driverQueue : [];
    const driverRecord = await prisma.comDriver.findUnique({
      where: { id: driver.id },
      select: { currentRideId: true }
    });
    console.log(`🔍 Driver record:`, driverRecord);
    console.log(`🔍 Checking access: ride.driverId=${ride.driverId}, driver.id=${driver.id}, driverQueue=${JSON.stringify(driverQueue)}, driver.currentRideId=${driverRecord?.currentRideId}, rideId=${rideId}`);
    console.log(`🔍 Access check: ride.driverId === driver.id: ${ride.driverId === driver.id}`);
    console.log(`🔍 Access check: driverQueue.includes(driver.id): ${driverQueue.includes(driver.id)}`);
    console.log(`🔍 Access check: driverRecord?.currentRideId === rideId: ${driverRecord?.currentRideId === rideId}`);
    if (ride.driverId !== driver.id && !driverQueue.includes(driver.id) && driverRecord?.currentRideId !== rideId) {
      console.log(`❌ Access denied: driver ${driver.id} not assigned to ride ${rideId}`);
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    console.log(`✅ Ride ${rideId} found for driver ${driver.id}`);

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

    console.log(`📤 Ride data sent to driver:`, response);
    return NextResponse.json(response);

  } catch (e: any) {
    console.error('❌ Error fetching ride:', e);
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    console.log(`📤 Error response sent to driver:`, errorResponse);
    return NextResponse.json(errorResponse, { status: 400 });
  }
}