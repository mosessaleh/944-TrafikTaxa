import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';
import { getSocketServer } from '@/lib/socket-server';
import { chargeCancellationFee } from '@/lib/payment-processor';
import { calculateDistance } from '@/lib/distance';

const PICKUP_COUNTDOWN_DURATION_SEC = 300;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const { reason, canceledBy } = body;

    if (!reason || !canceledBy) {
      return NextResponse.json({ ok: false, error: 'Reason and canceledBy are required' }, { status: 400 });
    }

    // Get the ride
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        user: true,
        vehicleType: true,
        savedPaymentMethod: true
      }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    // Check if driver has access
    if (ride.driverId !== driver.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Allow canceling CONFIRMED scheduled rides (driver releasing before dispatch)
    if (ride.status === 'CONFIRMED' && ride.scheduled) {
      await prisma.$transaction(async (tx) => {
        await tx.ride.update({
          where: { id: rideId },
          data: {
            driverId: null,
            car: null,
            driverQueue: []
          }
        });
        await tx.comDriver.update({
          where: { id: driver.id },
          data: {
            currentRideId: null
          }
        });
      });

      const io = getSocketServer();
      if (io) {
        io.to(`driver_${driver.id}`).emit('driverStatusUpdate', {
          currentRideId: null,
          isBusy: false,
          isOnline: true
        });
      }

      return NextResponse.json({
        ok: true,
        data: {
          message: 'Scheduled ride released successfully',
          cost: 0
        }
      });
    }

    // Check if ride is in correct status (DISPATCHED or ONGOING)
    if (ride.status !== 'DISPATCHED' && ride.status !== 'ONGOING') {
      return NextResponse.json({ ok: false, error: 'Ride cannot be canceled' }, { status: 400 });
    }

    // Calculate distance and time from acceptedAt to now
    const acceptedAt = ride.acceptedAt;
    if (!acceptedAt) {
      return NextResponse.json({ ok: false, error: 'Ride acceptance time not found' }, { status: 400 });
    }

    const now = new Date();
    const timeDiffMs = now.getTime() - acceptedAt.getTime();
    const timeDiffMin = Math.floor(timeDiffMs / (1000 * 60));

    // Enforce 5-minute pickup countdown based on proximity trigger
    const proximityMap = (global as any).pickupProximitySent as Map<string, any> | undefined;
    const proximityKey = `${rideId}_${driver.id}`;
    const proximityData = proximityMap?.get?.(proximityKey);
    if (!proximityData || !proximityData.countdownStart) {
      return NextResponse.json({ ok: false, error: 'Pickup countdown has not started yet' }, { status: 400 });
    }

    // لا نسمح بحساب أو اعتبار العد التنازلي قبل وقت الرحلة المجدول
    if (ride.scheduled && ride.pickupTime) {
      const scheduledTs = new Date(ride.pickupTime).getTime();
      if (proximityData.countdownStart < scheduledTs) {
        const adjustedElapsed = Math.floor((Date.now() - scheduledTs) / 1000);
        const countdownDuration = proximityData.countdownDuration || PICKUP_COUNTDOWN_DURATION_SEC;
        if (adjustedElapsed < countdownDuration) {
          return NextResponse.json({
            ok: false,
            error: 'Pickup countdown has not expired yet',
            data: {
              remainingSec: Math.max(0, countdownDuration - adjustedElapsed)
            }
          }, { status: 400 });
        }
      }
    }

    const countdownDuration = proximityData.countdownDuration || PICKUP_COUNTDOWN_DURATION_SEC;
    const elapsedFromCountdown = proximityData.expiredAt
      ? countdownDuration
      : Math.floor((Date.now() - proximityData.countdownStart) / 1000);

    if (elapsedFromCountdown < countdownDuration) {
      return NextResponse.json({
        ok: false,
        error: 'Pickup countdown has not expired yet',
        data: {
          remainingSec: Math.max(0, countdownDuration - elapsedFromCountdown)
        }
      }, { status: 400 });
    }

    // Estimate distance traveled using location at proximity start vs latest known driver location
    let distanceKm = 0;
    const startLocation = proximityData.startLocation;
    if (startLocation && typeof startLocation.lat === 'number' && typeof startLocation.lng === 'number') {
      let currentLocation: { lat: number; lng: number } | null = null;
      if (Array.isArray(driver.lastLocation) && driver.lastLocation.length >= 2) {
        const lastLat = Number(driver.lastLocation[0]);
        const lastLng = Number(driver.lastLocation[1]);
        if (!Number.isNaN(lastLat) && !Number.isNaN(lastLng)) {
          currentLocation = { lat: lastLat, lng: lastLng };
        }
      }
      if (currentLocation) {
        distanceKm = calculateDistance(startLocation.lat, startLocation.lng, currentLocation.lat, currentLocation.lng);
      }
    }

    // Calculate cost based on settings
    const settings = await prisma.settings.findFirst();
    if (!settings) {
      return NextResponse.json({ ok: false, error: 'Settings not found' }, { status: 500 });
    }

    // Determine if day or night
    const pickupTime = new Date(ride.pickupTime);
    const hour = pickupTime.getHours();
    const workStartHour = parseInt(settings.workStart.split(':')[0]);
    const workEndHour = parseInt(settings.workEnd.split(':')[0]);
    const isDay = hour >= workStartHour && hour < workEndHour;

    const basePrice = isDay ? settings.dayBase : settings.nightBase;
    const perKmPrice = isDay ? settings.dayPerKm : settings.nightPerKm;
    const perMinPrice = isDay ? settings.dayPerMin : settings.nightPerMin;

    const cost = basePrice + (distanceKm * perKmPrice) + (timeDiffMin * perMinPrice);

    // Process payment deduction
    // This would integrate with payment processor to deduct from driver's account
    // For now, we'll just record it

    const roundedCost = Math.max(0, Math.round(cost));
    const originalPriceDkk = Math.max(0, Math.round(ride.price || 0));
    const shouldProcessPayment = Boolean(
      ride.paymentRef || (ride.savedPaymentMethodId && roundedCost > 0)
    );
    const paymentResult = shouldProcessPayment
      ? await chargeCancellationFee(
          {
            ...ride,
            savedPaymentMethod: ride.savedPaymentMethod
          }
        )
      : null;

    const paymentStatus = paymentResult?.success
      ? 'PAID'
      : roundedCost > 0
        ? 'UNPAID'
        : 'PAID';

    const explanation = paymentResult?.success
      ? paymentResult.refundId
        ? `Cancellation fee adjusted - Refund ${paymentResult.refundedAmountDkk} DKK, Refund: ${paymentResult.refundId}`
        : paymentResult.canceledAuthorization && roundedCost <= 0
          ? 'Authorization canceled - No cancellation fee'
          : `Cancellation fee paid - Transaction: ${paymentResult.transactionId}`
      : ride.explanation;

    await prisma.$transaction(async (tx) => {
      // Update ride
      await tx.ride.update({
        where: { id: rideId },
        data: {
          status: 'CANCELED',
          cancellationReason: reason,
          canceledBy: canceledBy,
          distanceKm: distanceKm,
          durationMin: timeDiffMin,
          price: roundedCost,
          paymentStatus: paymentStatus,
          paymentRef: paymentResult?.transactionId || ride.paymentRef,
          explanation: explanation
        } as any
      });

      // Update driver status to online and available
      await tx.comDriver.update({
        where: { id: driver.id },
        data: {
          isOnline: true,
          isBusy: false,
          currentRideId: null
        }
      });

      // Create invoice for the cancellation fee
      const invoiceNumber = `CANCEL-${rideId}-${Date.now()}`;
      await tx.invoice.create({
        data: {
          invoiceNumber: invoiceNumber,
          userId: ride.userId,
          rideId: rideId,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentStatus: paymentStatus,
          status: 1,
          paymentMethod: ride.paymentMethod,
          paymentRef: paymentResult?.transactionId || `cancel-${rideId}`,
          paymentDate: paymentResult?.success ? new Date() : null,
          paymentAmount: roundedCost,
          confirmedBy: null,
          confirmedAt: paymentResult?.success ? new Date() : null,
          receiptNumber: invoiceNumber
        }
      });
    });

    // Clean up pickup proximity state
    if (proximityMap?.delete) {
      proximityMap.delete(proximityKey);
    }

    // Get socket server
    const io = getSocketServer();
    if (io) {
      // Send status update to driver via socket
      io.to(`driver_${driver.id}`).emit('driverStatusUpdate', {
        currentRideId: null,
        isBusy: false,
        isOnline: true
      });

      // Send cancellation notification to passenger via socket
      io.to(`user_${ride.userId}`).emit('rideCancelled', {
        rideId: rideId,
        reason: reason,
        canceledBy: canceledBy,
        cost: Math.round(cost),
        message: 'The driver has cancelled the ride'
      });
      
      // Also notify admins if needed
      io.to('admins').emit('rideCancelledByDriver', {
        rideId: rideId,
        driverId: driver.id,
        driverName: `${driver.drFname || ''} ${driver.drLname || ''}`.trim() || driver.drUsername,
        passengerId: ride.userId,
        reason: reason,
        cost: Math.round(cost)
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        message: 'Ride canceled successfully',
        cost: roundedCost,
        distanceKm: distanceKm,
        timeMin: timeDiffMin,
        paymentStatus: paymentStatus,
        paymentRef: paymentResult?.transactionId || ride.paymentRef
      }
    });

  } catch (e: any) {
    console.error('Cancel ride error:', e);
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    return NextResponse.json(errorResponse, { status: 400 });
  }
}
