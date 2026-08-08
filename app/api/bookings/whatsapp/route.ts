import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { sanitizeInput } from '@/lib/sanitize';
import { notifyBookingConfirmedUnified } from '@/lib/notification-service';
import { getUserSessionByToken } from '@/lib/wa-sessions';

const prismaAny = prisma as any;

const createBookingSchema = z.object({
  riderName: z.string().min(2).max(100),
  pickupAddress: z.string().min(3).max(500),
  dropoffAddress: z.string().min(3).max(500),
  stopAddress: z.string().min(3).max(500).optional().nullable(),
  pickupLat: z.number().min(-90).max(90).optional().nullable(),
  pickupLon: z.number().min(-180).max(180).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional().nullable(),
  dropoffLon: z.number().min(-180).max(180).optional().nullable(),
  vehicleTypeId: z.number().int().positive(),
  scheduled: z.boolean(),
  pickupTime: z.string(),
  driverNote: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('x-whatsapp-session-token');
    let userId: number;

    if (sessionToken) {
      const session = await getUserSessionByToken(sessionToken);
      if (!session || !session.userId) {
        return NextResponse.json(
          { ok: false, error: 'Invalid or expired WhatsApp session' },
          { status: 401 }
        );
      }
      userId = session.userId;
    } else {
      userId = parseInt(request.headers.get('x-whatsapp-user-id') || '0');
      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'Missing authentication' },
          { status: 401 }
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true },
    });

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const rawData = await request.json();

    const sanitizedData = {
      riderName: sanitizeInput(rawData.riderName, 'text'),
      pickupAddress: sanitizeInput(rawData.pickupAddress, 'address'),
      dropoffAddress: sanitizeInput(rawData.dropoffAddress, 'address'),
      stopAddress: null,
      pickupLat: rawData.pickupLat || null,
      pickupLon: rawData.pickupLon || null,
      dropoffLat: rawData.dropoffLat || null,
      dropoffLon: rawData.dropoffLon || null,
      vehicleTypeId: parseInt(rawData.vehicleTypeId),
      scheduled: rawData.scheduled === 'true' || rawData.scheduled === true,
      pickupTime: rawData.pickupTime,
      driverNote: null,
    };

    const validatedData = createBookingSchema.parse(sanitizedData);

    // Verify vehicle type
    const vehicleType = await prismaAny.vehicleType.findUnique({
      where: { id: validatedData.vehicleTypeId },
      select: { id: true, active: true },
    });

    if (!vehicleType || !vehicleType.active) {
      return NextResponse.json(
        { ok: false, error: 'Selected vehicle type is not available' },
        { status: 400 }
      );
    }

    // Calculate distance and duration
    let distanceKm: number, durationMin: number;
    try {
      const result = await safeEstimateDistance(
        {
          address: validatedData.pickupAddress,
          lat: validatedData.pickupLat || null,
          lon: validatedData.pickupLon || null,
        },
        {
          address: validatedData.dropoffAddress,
          lat: validatedData.dropoffLat || null,
          lon: validatedData.dropoffLon || null,
        }
      );
      distanceKm = result.distanceKm;
      durationMin = result.durationMin;
    } catch (error: any) {
      console.error('[WhatsApp Booking] Distance calculation failed:', error);
      return NextResponse.json(
        { ok: false, error: 'Unable to calculate route for the selected addresses.' },
        { status: 400 }
      );
    }

    if (distanceKm < 0.1) {
      return NextResponse.json(
        { ok: false, error: 'Pickup and dropoff locations are too close.' },
        { status: 400 }
      );
    }

    // Calculate price
    const pickupTime = new Date(validatedData.pickupTime);
    const price = await computePrice(
      distanceKm,
      durationMin,
      pickupTime,
      validatedData.vehicleTypeId,
      { isScheduled: validatedData.scheduled }
    );

    // Create booking
    const booking = await prismaAny.ride.create({
      data: {
        userId: user.id,
        riderName: validatedData.riderName,
        passengers: 1,
        pickupAddress: validatedData.pickupAddress,
        dropoffAddress: validatedData.dropoffAddress,
        stopAddress: validatedData.stopAddress || null,
        startLatLon: validatedData.pickupLat && validatedData.pickupLon
          ? { lat: validatedData.pickupLat, lon: validatedData.pickupLon }
          : null,
        endLatLon: validatedData.dropoffLat && validatedData.dropoffLon
          ? { lat: validatedData.dropoffLat, lon: validatedData.dropoffLon }
          : null,
        scheduled: validatedData.scheduled,
        pickupTime,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin,
        price,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: 'cash',
        driverNote: validatedData.driverNote?.trim() || null,
        vehicleTypeId: validatedData.vehicleTypeId,
        driverQueue: [],
      } as any,
      include: {
        vehicleType: {
          select: { title: true, capacity: true },
        },
      },
    });

    console.log(`[WhatsApp Booking] Created booking #${booking.id} for user ${user.id}`);

    // Send notification (fire-and-forget)
    notifyBookingConfirmedUnified(
      { id: user.id, email: user.email, firstName: user.firstName },
      {
        id: booking.id,
        pickupTime: booking.pickupTime.toISOString(),
        riderName: booking.riderName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        price: booking.price,
        vehicleTypeId: booking.vehicleTypeId,
      }
    ).catch((error) => {
      console.error('[WhatsApp Booking] Notification error:', error);
    });

    return NextResponse.json({
      ok: true,
      ride: {
        id: booking.id,
        riderName: booking.riderName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        pickupTime: booking.pickupTime.toISOString(),
        price: booking.price,
        status: booking.status,
        paymentMethod: booking.paymentMethod,
        vehicleType: (booking as any).vehicleType || { title: 'Standard', capacity: 4 },
      },
      message: 'Booking created successfully.',
    }, { status: 201 });

  } catch (error) {
    console.error('[WhatsApp Booking] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Could not create booking.' },
      { status: 400 }
    );
  }
}