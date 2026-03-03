import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';

const {
  getDriverScheduleSnapshot,
  ensureDriverScheduleTables
} = require('@/lib/driver-schedule');

const SCHEDULED_OFFER_TIMEOUT_MS = 3 * 60 * 1000;

function getScheduledOfferExpiryMs(offerState: any) {
  const createdAtMs = Number(offerState?.createdAt || Date.now());
  const timeoutMs = Number(offerState?.timeoutMs || SCHEDULED_OFFER_TIMEOUT_MS);
  return createdAtMs + timeoutMs;
}

function buildPendingScheduledOffersForDriver(driverId: number) {
  const offersMap = (global as any).scheduledOffers;
  if (!(offersMap instanceof Map)) {
    return [] as any[];
  }

  const now = Date.now();
  const pending: any[] = [];

  for (const offerState of offersMap.values()) {
    if (!offerState || !Array.isArray(offerState.candidates)) continue;

    const isCandidate = offerState.candidates.some((candidate: any) => Number(candidate?.driverId) === driverId);
    if (!isCandidate) continue;

    if (offerState.accepted?.has?.(driverId)) continue;
    if (offerState.rejected?.has?.(driverId)) continue;

    const expiresAt = getScheduledOfferExpiryMs(offerState);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;

    pending.push({
      rideId: Number(offerState.rideId),
      pickupTime: offerState.pickupTime || null,
      createdAt: Number(offerState.createdAt || now),
      timeoutMs: Number(offerState.timeoutMs || SCHEDULED_OFFER_TIMEOUT_MS),
      expiresAt,
      timeLeftMs: Math.max(0, expiresAt - now),
      rideData: offerState.rideData || null
    });
  }

  pending.sort((a, b) => Number(a.expiresAt) - Number(b.expiresAt));
  return pending;
}

export async function GET(req: NextRequest) {
  let driver;
  try {
    driver = await requireDriverByJWT(req);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    await ensureDriverScheduleTables(prisma);

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

    const schedule = await getDriverScheduleSnapshot(prisma, driver.id, now);
    const pendingOffers = buildPendingScheduledOffersForDriver(Number(driver.id));

    return NextResponse.json({
      ok: true,
      rides,
      pendingOffers,
      pendingCount: pendingOffers.length,
      schedule
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}
