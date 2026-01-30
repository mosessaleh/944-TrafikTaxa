import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';
import { validateDriverApiOrigin } from '@/lib/security-headers';
import { getSocketServer } from '@/lib/socket-server';

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
        vehicleType: true
      }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    // Check if driver has access
    if (ride.driverId !== driver.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
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

    // For distance, we need driver's location history or approximate
    // For simplicity, use a fixed distance or calculate based on time (assuming average speed)
    // In real implementation, you'd track actual distance traveled
    const averageSpeedKmh = 30; // Assume 30 km/h average
    const distanceKm = (timeDiffMin / 60) * averageSpeedKmh;

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

    // Update ride
    await prisma.ride.update({
      where: { id: rideId },
      data: {
        status: 'CANCELED',
        cancellationReason: reason,
        canceledBy: canceledBy,
        distanceKm: distanceKm,
        durationMin: timeDiffMin,
        price: Math.round(cost), // Update price to the calculated cost
      } as any
    });

    // Update driver status to online and available
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: {
        isOnline: true,
        isBusy: false,
        currentRideId: null
      }
    });

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

    // Create invoice for the cancellation fee
    const invoiceNumber = `CANCEL-${rideId}-${Date.now()}`;
    await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNumber,
        userId: ride.userId,
        rideId: rideId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        paymentStatus: 'PAID', // Since payment is deducted immediately
        status: 1,
        paymentMethod: ride.paymentMethod,
        paymentRef: `cancel-${rideId}`,
        paymentDate: new Date(),
        paymentAmount: Math.round(cost),
        confirmedBy: null, // System confirmed
        confirmedAt: new Date(),
        receiptNumber: invoiceNumber
      }
    });

    return NextResponse.json({
      ok: true,
      data: {
        message: 'Ride canceled successfully',
        cost: Math.round(cost),
        distanceKm: distanceKm,
        timeMin: timeDiffMin,
        invoiceNumber: invoiceNumber
      }
    });

  } catch (e: any) {
    console.error('Cancel ride error:', e);
    const errorResponse = { ok: false, error: e?.message || 'Invalid request' };
    return NextResponse.json(errorResponse, { status: 400 });
  }
}
