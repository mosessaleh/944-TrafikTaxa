import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { getSocketServer } from '@/lib/socket-server';
import { sendPushToDriver } from '@/lib/notification-service';
import { sendWAText } from '@/lib/wa-client';
import { logWAError } from '@/lib/wa-logger';

const { connectedDrivers } = require('@/lib/connected-drivers');

const DispatchSchema = z.discriminatedUnion('mode', [
  z.object({
    id: z.number().int().positive(),
    mode: z.literal('manual'),
    driverId: z.number().int().positive(),
  }),
  z.object({
    id: z.number().int().positive(),
    mode: z.literal('auto'),
  }),
]);

function normalizeDriverQueue(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function buildRidePayload(ride: any) {
  return {
    id: ride.id,
    pickupAddress: ride.pickupAddress,
    stopAddress: ride.stopAddress || null,
    dropoffAddress: ride.dropoffAddress,
    price: ride.price,
    distanceKm: ride.distanceKm,
    riderName: ride.riderName,
    startLatLon: ride.startLatLon,
    stopLatLon: ride.stopLatLon,
    endLatLon: ride.endLatLon,
    vehicleTypeId: ride.vehicleTypeId,
    pickupTime: ride.pickupTime,
    scheduled: Boolean(ride.scheduled),
    offerType: ride.scheduled ? 'scheduled' : 'immediate',
  };
}

function clearImmediateOffer(rideId: number, exceptDriverId?: number) {
  const activeOffers = (global as any).activeOffers;
  if (!(activeOffers instanceof Map)) return;

  const currentDriverId = Number(activeOffers.get(rideId));
  if (!Number.isFinite(currentDriverId) || currentDriverId <= 0) return;
  if (exceptDriverId && currentDriverId === exceptDriverId) return;

  const io = getSocketServer();
  if (io) {
    io.to(`driver_${currentDriverId}`).emit('rideCancelled', {
      rideId,
      reason: 'Ride was reassigned by dispatcher',
    });
  }

  activeOffers.delete(rideId);
}

function clearScheduledOfferState(rideId: number) {
  const scheduledOffers = (global as any).scheduledOffers;
  if (!(scheduledOffers instanceof Map)) return;

  const offerState = scheduledOffers.get(rideId);
  if (!offerState) return;

  if (offerState.timerId) {
    clearTimeout(offerState.timerId);
  }

  scheduledOffers.delete(rideId);

  const io = getSocketServer();
  if (io && Array.isArray(offerState.candidates)) {
    for (const candidate of offerState.candidates) {
      const candidateDriverId = Number(candidate?.driverId);
      if (!Number.isFinite(candidateDriverId) || candidateDriverId <= 0) continue;
      io.to(`driver_${candidateDriverId}`).emit('rideCancelled', { rideId });
    }
  }
}


export async function POST(req: NextRequest) {
  try {
    await requirePermission('dispatch.manage');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const payload = DispatchSchema.parse(await req.json());
    const ride = await prisma.ride.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        status: true,
        scheduled: true,
        pickupTime: true,
        pickupAddress: true,
        stopAddress: true,
        dropoffAddress: true,
        price: true,
        distanceKm: true,
        riderName: true,
        startLatLon: true,
        stopLatLon: true,
        endLatLon: true,
        vehicleTypeId: true,
        paymentMethod: true,
        driverId: true,
        car: true,
        driverQueue: true,
      },
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    if (ride.status !== 'CONFIRMED') {
      return NextResponse.json({ ok: false, error: 'Only confirmed rides can be dispatched' }, { status: 400 });
    }

    if (!ride.paymentMethod) {
      return NextResponse.json({ ok: false, error: 'Ride has no payment method yet' }, { status: 409 });
    }

    if (payload.mode === 'auto') {
      const activeOffers = (global as any).activeOffers instanceof Map
        ? (global as any).activeOffers
        : ((global as any).activeOffers = new Map());
      if (activeOffers instanceof Map && activeOffers.has(ride.id)) {
        return NextResponse.json({ ok: false, error: 'This ride already has an active driver offer' }, { status: 409 });
      }

      const dispatcher = (global as any).checkForNewRides;
      if (typeof dispatcher !== 'function') {
        return NextResponse.json({ ok: false, error: 'Dispatcher service is not available' }, { status: 503 });
      }

      await dispatcher();

      const updatedRide = await prisma.ride.findUnique({
        where: { id: ride.id },
        select: {
          id: true,
          status: true,
          driverId: true,
          car: true,
          scheduled: true,
          driverQueue: true,
        },
      });

      const nextActiveOfferDriverId = activeOffers instanceof Map ? Number(activeOffers.get(ride.id)) : null;
      const scheduledOffers = (global as any).scheduledOffers;
      const hasScheduledOffer = scheduledOffers instanceof Map ? scheduledOffers.has(ride.id) : false;

      if (updatedRide?.driverId && updatedRide?.scheduled && updatedRide.status === 'CONFIRMED') {
        return NextResponse.json({
          ok: true,
          ride: updatedRide,
          message: `Driver #${updatedRide.driverId} was assigned to the scheduled ride.`,
        });
      }

      if (updatedRide?.driverId && updatedRide.status === 'DISPATCHED') {
        notifyRiderWhatsApp(updatedRide.id, Number(updatedRide.driverId)).catch(() => {});
        return NextResponse.json({
          ok: true,
          ride: updatedRide,
          message: `Ride dispatched to driver #${updatedRide.driverId}.`,
        });
      }

      if (Number.isFinite(nextActiveOfferDriverId) && nextActiveOfferDriverId && nextActiveOfferDriverId > 0) {
        return NextResponse.json({
          ok: true,
          ride: updatedRide,
          message: `Ride offer sent to the nearest available driver #${nextActiveOfferDriverId}.`,
        });
      }

      if (hasScheduledOffer) {
        return NextResponse.json({
          ok: true,
          ride: updatedRide,
          message: 'Scheduled ride offers were sent to available drivers.',
        });
      }

      return NextResponse.json({ ok: false, error: 'No available drivers were found for this ride' }, { status: 409 });
    }

    const driver = await prisma.comDriver.findUnique({
      where: { id: payload.driverId },
      select: {
        id: true,
        drFname: true,
        drLname: true,
        car: true,
        isOnline: true,
        isBusy: true,
        isActive: true,
        currentRideId: true,
        bannedUntil: true,
      },
    });

    if (!driver || !driver.isActive) {
      return NextResponse.json({ ok: false, error: 'Driver not found or inactive' }, { status: 404 });
    }

    if (ride.scheduled) {
      clearImmediateOffer(ride.id);
      clearScheduledOfferState(ride.id);

      const updatedRide = await prisma.ride.update({
        where: { id: ride.id },
        data: {
          driverId: driver.id,
          car: driver.car || ride.car || null,
          driverQueue: Array.from(new Set([driver.id, ...normalizeDriverQueue(ride.driverQueue)])),
        },
        select: {
          id: true,
          status: true,
          driverId: true,
          car: true,
          scheduled: true,
          pickupTime: true,
          pickupAddress: true,
          stopAddress: true,
          dropoffAddress: true,
          price: true,
          distanceKm: true,
          riderName: true,
          startLatLon: true,
          stopLatLon: true,
          endLatLon: true,
          vehicleTypeId: true,
          driverQueue: true,
        },
      });

      const io = getSocketServer();
      if (io) {
        io.to(`driver_${driver.id}`).emit('scheduledOfferResult', {
          rideId: updatedRide.id,
          selected: true,
          pickupTime: updatedRide.pickupTime,
          rideData: buildRidePayload(updatedRide),
        });
      }

      try {
        await sendPushToDriver(
          driver.id,
          'Scheduled ride assigned',
          `A scheduled ride has been assigned to you for ${new Date(updatedRide.pickupTime).toLocaleString()}.`,
          {
            type: 'scheduledRideAssigned',
            rideId: updatedRide.id,
            pickupTime: updatedRide.pickupTime,
          }
        );
      } catch (error) {
        console.warn('[dispatch] scheduled driver push failed', error);
      }

      return NextResponse.json({
        ok: true,
        ride: updatedRide,
        message: `Scheduled ride assigned to driver #${driver.id}.`,
      });
    }

    const now = new Date();
    if (driver.bannedUntil && driver.bannedUntil > now) {
      return NextResponse.json({ ok: false, error: 'Driver is temporarily restricted from receiving rides' }, { status: 409 });
    }

    if (!driver.isOnline || !connectedDrivers?.has?.(driver.id)) {
      return NextResponse.json({ ok: false, error: 'Driver is not connected right now' }, { status: 409 });
    }

    if (driver.isBusy || (driver.currentRideId && driver.currentRideId !== ride.id)) {
      return NextResponse.json({ ok: false, error: 'Driver is currently busy' }, { status: 409 });
    }

    const io = getSocketServer();
    if (!io) {
      return NextResponse.json({ ok: false, error: 'Socket server is not available' }, { status: 503 });
    }

    clearImmediateOffer(ride.id, driver.id);
    clearScheduledOfferState(ride.id);

    const rideOfferData = {
      type: 'newRide',
      rideId: ride.id,
      rideData: buildRidePayload(ride),
      timestamp: Date.now(),
      timeoutMs: 30000,
    };

    if (!((global as any).activeOffers instanceof Map)) {
      (global as any).activeOffers = new Map();
    }
    (global as any).activeOffers.set(ride.id, driver.id);
    io.to(`driver_${driver.id}`).emit('rideOffer', rideOfferData);

    try {
      await sendPushToDriver(
        driver.id,
        'New ride available',
        `Pickup: ${ride.pickupAddress} -> Dropoff: ${ride.dropoffAddress}`,
        {
          type: 'newRide',
          rideId: ride.id,
        }
      );
    } catch (error) {
      console.warn('[dispatch] immediate driver push failed', error);
    }

    // Send WhatsApp notification to rider when driver is dispatched (manual mode)
    notifyRiderWhatsApp(ride.id, driver.id).catch(err => logWAError('dispatch_notify_rider', err));

    return NextResponse.json({
      ok: true,
      ride,
      message: `Ride offer sent to driver #${driver.id}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid' }, { status: 400 });
  }
}

async function notifyRiderWhatsApp(rideId: number, driverId: number) {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { id: true, pickupAddress: true, dropoffAddress: true, userId: true },
    });
    if (!ride) return;

    const user = await prisma.user.findUnique({
      where: { id: ride.userId },
      select: { phone: true, firstName: true },
    });
    if (!user?.phone) return;

    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { drFname: true, drLname: true, car: true },
    });
    const driverName = driver ? `${driver.drFname} ${driver.drLname}`.trim() : 'Driver';
    const carInfo = driver?.car || 'N/A';

    const msg = `🚕 *Driver assigned!*\n\nDriver: ${driverName}\nCar: ${carInfo}\n📋 Ride #${ride.id}\n📍 ${ride.pickupAddress} → ${ride.dropoffAddress}\n\nThe driver is on the way.\n\n💬 *Chat with your driver / الدردشة مع السائق / Chat med chauffør:*\nYou can now send messages here — they will be forwarded to your driver. Simply reply to this chat.\nيمكنك الآن إرسال رسائل هنا وسيتم توجيهها إلى السائق. ما عليك سوى الرد على هذه المحادثة.\nDu kan nu sende beskeder her — de vil blive videresendt til din chauffør. Svar blot på denne chat.`;

    sendWAText(user.phone, msg).catch(() => {});
  } catch (e) {
    logWAError('dispatch_wa_notify', e);
  }
}
