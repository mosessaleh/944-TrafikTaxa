import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitize';

// Validation schema for booking creation
const createBookingSchema = z.object({
  riderName: z.string()
    .min(2, "Rider name must be at least 2 characters")
    .max(100, "Rider name is too long")
    .regex(/^[^\u0600-\u06FF\s\-'\.]+$/u, "Rider name contains invalid characters"),
  pickupAddress: z.string()
    .min(3, "Pickup address must be at least 3 characters")
    .max(500, "Pickup address is too long")
    .regex(/^[^\u0600-\u06FF0-9\s,.\-#&()\/]+$/u, "Pickup address contains invalid characters"),
  dropoffAddress: z.string()
    .min(3, "Dropoff address must be at least 3 characters")
    .max(500, "Dropoff address is too long")
    .regex(/^[^\u0600-\u06FF0-9\s,.\-#&()\/]+$/u, "Dropoff address contains invalid characters"),
  pickupLat: z.number().min(-90).max(90).optional().nullable(),
  pickupLon: z.number().min(-180).max(180).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional().nullable(),
  dropoffLon: z.number().min(-180).max(180).optional().nullable(),
  vehicleTypeId: z.number().int().positive("Invalid vehicle type"),
  scheduled: z.boolean(),
  pickupTime: z.string().refine(val => {
    const date = new Date(val);
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(now.getDate() + 90);
    return date > now && date <= maxFuture;
  }, "Pickup time must be in the future but within 90 days"),
});

/**
 * GET /api/bookings - Fetch user's bookings
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('bookings:' + clientIpKey(request), { points: 30, durationSec: 60 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { ok: false, error: 'Email verification required' },
        { status: 403 }
      );
    }

    // Fetch bookings with vehicle type information
    const bookings = await prisma.ride.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicleType: {
          select: {
            title: true,
            capacity: true
          }
        }
      }
    });

    // Transform bookings for frontend consumption
    const transformedBookings = bookings.map(booking => ({
      id: booking.id,
      riderName: booking.riderName,
      passengers: booking.passengers,
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupTime: booking.pickupTime.toISOString(),
      distanceKm: booking.distanceKm,
      durationMin: booking.durationMin,
      price: booking.price,
      status: booking.status,
      scheduled: booking.scheduled,
      vehicleType: booking.vehicleType,
      createdAt: booking.createdAt.toISOString()
    }));

    return NextResponse.json({
      ok: true,
      bookings: transformedBookings,
      count: transformedBookings.length
    });

  } catch (error) {
    console.error('[API] Error fetching bookings:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings - Create a new booking
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('book:' + clientIpKey(request), { points: 5, durationSec: 60 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { ok: false, error: 'Email verification required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const rawData = await request.json();

    // Sanitize inputs before validation
    const sanitizedData = {
      riderName: sanitizeInput(rawData.riderName, 'text'),
      pickupAddress: sanitizeInput(rawData.pickupAddress, 'address'),
      dropoffAddress: sanitizeInput(rawData.dropoffAddress, 'address'),
      pickupLat: sanitizeInput(rawData.pickupLat, 'number'),
      pickupLon: sanitizeInput(rawData.pickupLon, 'number'),
      dropoffLat: sanitizeInput(rawData.dropoffLat, 'number'),
      dropoffLon: sanitizeInput(rawData.dropoffLon, 'number'),
      vehicleTypeId: sanitizeInput(rawData.vehicleTypeId, 'number'),
      scheduled: sanitizeInput(rawData.scheduled, 'boolean'),
      pickupTime: rawData.pickupTime // Keep as string for date validation
    };

    const validatedData = createBookingSchema.parse(sanitizedData);

    // Verify vehicle type exists and is active
    const vehicleType = await prisma.vehicleType.findUnique({
      where: { id: validatedData.vehicleTypeId },
      select: { id: true, active: true }
    });

    if (!vehicleType || !vehicleType.active) {
      return NextResponse.json(
        { ok: false, error: 'Selected vehicle type is not available' },
        { status: 400 }
      );
    }

    // Calculate distance and duration
    const { distanceKm, durationMin } = await safeEstimateDistance(
      {
        address: validatedData.pickupAddress,
        lat: validatedData.pickupLat || null,
        lon: validatedData.pickupLon || null
      },
      {
        address: validatedData.dropoffAddress,
        lat: validatedData.dropoffLat || null,
        lon: validatedData.dropoffLon || null
      }
    );

    // Calculate price
    const pickupTime = new Date(validatedData.pickupTime);
    const price = await computePrice(distanceKm, durationMin, pickupTime, validatedData.vehicleTypeId);

    // Create booking
    const booking = await prisma.ride.create({
      data: {
        userId: user.id,
        riderName: validatedData.riderName,
        passengers: 1,
        pickupAddress: validatedData.pickupAddress,
        dropoffAddress: validatedData.dropoffAddress,
        scheduled: validatedData.scheduled,
        pickupTime,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin,
        price,
        vehicleTypeId: validatedData.vehicleTypeId
      },
      include: {
        vehicleType: {
          select: {
            title: true,
            capacity: true
          }
        }
      }
    });

    // Send notification to admin (async, don't wait)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      const title = validatedData.scheduled ? 'Scheduled booking' : 'Immediate booking';
      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(
          adminEmail,
          `${title} #${booking.id}`,
          `<p>New booking details:</p>
          <ul>
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Customer:</strong> ${user.firstName} ${user.lastName} (${user.email})</li>
            <li><strong>Rider:</strong> ${booking.riderName}</li>
            <li><strong>Vehicle:</strong> ${booking.vehicleType.title}</li>
            <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
            <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
            <li><strong>Time:</strong> ${booking.pickupTime.toISOString()}</li>
            <li><strong>Distance:</strong> ${booking.distanceKm} km</li>
            <li><strong>Duration:</strong> ${booking.durationMin} minutes</li>
            <li><strong>Price:</strong> ${booking.price} DKK</li>
          </ul>`
        )
      ).catch((error) => {
        console.error('[API] Failed to send admin notification:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        riderName: booking.riderName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        pickupTime: booking.pickupTime.toISOString(),
        price: booking.price,
        status: booking.status,
        vehicleType: booking.vehicleType
      }
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error creating booking:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Could not place booking. Please refine addresses and try again.' },
      { status: 400 }
    );
  }
}