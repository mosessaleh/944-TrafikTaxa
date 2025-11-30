import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitize';
import { assessBookingRisk, updateBookingRisk } from '@/lib/risk-assessment';

// Validation schema for booking creation
const createBookingSchema = z.object({
  riderName: z.string()
    .min(2, "Rider name must be at least 2 characters")
    .max(100, "Rider name is too long"),
  pickupAddress: z.string()
    .min(3, "Pickup address must be at least 3 characters")
    .max(500, "Pickup address is too long"),
  dropoffAddress: z.string()
    .min(3, "Dropoff address must be at least 3 characters")
    .max(500, "Dropoff address is too long"),
  pickupLat: z.number().min(-90).max(90).optional().nullable(),
  pickupLon: z.number().min(-180).max(180).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional().nullable(),
  dropoffLon: z.number().min(-180).max(180).optional().nullable(),
  vehicleTypeId: z.number().int().positive("Invalid vehicle type"),
  scheduled: z.boolean(),
  pickupTime: z.string(),
}).superRefine((data, ctx) => {
  const now = new Date();
  const maxFuture = new Date();
  maxFuture.setDate(now.getDate() + 90);

  const addPickupError = (message: string) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pickupTime'],
      message,
    });
  };

  const date = new Date(data.pickupTime);
  if (Number.isNaN(date.getTime())) {
    addPickupError("Invalid pickup time");
    return;
  }

  if (data.scheduled) {
    // For scheduled bookings: at least 1 hour from now, and within 90 days
    const minScheduled = new Date(now.getTime() + 60 * 60 * 1000);
    if (date <= minScheduled || date > maxFuture) {
      addPickupError("For scheduled bookings, pickup time must be at least 1 hour from now and within 90 days");
    }
  } else {
    // For immediate bookings: must be in the future (no 1-hour requirement) and within 90 days
    if (!(date > now && date <= maxFuture)) {
      addPickupError("Pickup time must be in the future but within 90 days");
    }
  }
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

    if (user.type === 'user' && !((user as any).emailVerified)) {
      return NextResponse.json(
        { ok: false, error: 'Email verification required' },
        { status: 403 }
      );
    }

    // Fetch bookings with vehicle type information
    const bookings = await prisma.ride.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        riderName: true,
        passengers: true,
        pickupAddress: true,
        dropoffAddress: true,
        scheduled: true,
        pickupTime: true,
        distanceKm: true,
        durationMin: true,
        price: true,
        status: true,
        explanation: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        vehicleType: {
          select: {
            title: true,
            capacity: true
          }
        }
      }
    });

    // Fetch complaint status for each booking
    const bookingsWithComplaints = await Promise.all(
      bookings.map(async (booking: typeof bookings[number]) => {
        try {
          const complaint = await prisma.complaint.findFirst({
            where: { rideId: booking.id },
            select: {
              id: true,
              status: true
            },
            orderBy: { createdAt: 'desc' }
          });

          return {
            ...booking,
            hasComplaint: !!complaint,
            complaintStatus: complaint?.status || null
          };
        } catch (error) {
          console.error(`Error fetching complaint for booking ${booking.id}:`, error);
          return {
            ...booking,
            hasComplaint: false,
            complaintStatus: null
          };
        }
      })
    );

    // Transform bookings for frontend consumption
     const transformedBookings = bookingsWithComplaints.map((booking: typeof bookingsWithComplaints[number]) => ({
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
        paymentStatus: booking.paymentStatus,
        explanation: booking.explanation,
        paymentMethod: booking.paymentMethod,
        scheduled: booking.scheduled,
        vehicleType: booking.vehicleType || { title: 'Standard', capacity: 4 },
        hasComplaint: booking.hasComplaint,
        complaintStatus: booking.complaintStatus,
        createdAt: booking.createdAt.toISOString()
      }));

    return NextResponse.json({
      ok: true,
      rides: transformedBookings,
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

    if (user.type === 'user' && !((user as any).emailVerified)) {
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
      pickupLat: rawData.pickupLat ? parseFloat(rawData.pickupLat) : null,
      pickupLon: rawData.pickupLon ? parseFloat(rawData.pickupLon) : null,
      dropoffLat: rawData.dropoffLat ? parseFloat(rawData.dropoffLat) : null,
      dropoffLon: rawData.dropoffLon ? parseFloat(rawData.dropoffLon) : null,
      vehicleTypeId: parseInt(rawData.vehicleTypeId),
      scheduled: rawData.scheduled === 'true' || rawData.scheduled === true,
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

    // Only allow scheduled bookings (deferred bookings)
    if (!validatedData.scheduled) {
      return NextResponse.json(
        { ok: false, error: 'Instant booking is currently disabled. Please schedule your booking for later.' },
        { status: 400 }
      );
    }

    // Check payment method requirements - validation moved to client side
    const paymentMethod = rawData.paymentMethod; // No default, allow null

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

    // Get selected payment method for booking association
    let selectedPaymentMethodId: number | null = null;
    if (paymentMethod === 'card') {
      // Find the default or first active card payment method
      const defaultCard = await (prisma as any).userPaymentMethod.findFirst({
        where: {
          userId: user.id,
          type: 'card',
          isActive: true,
          isDefault: true
        }
      });

      if (defaultCard) {
        selectedPaymentMethodId = defaultCard.id;
      } else {
        // Get first active card if no default
        const firstCard = await (prisma as any).userPaymentMethod.findFirst({
          where: {
            userId: user.id,
            type: 'card',
            isActive: true
          }
        });
        selectedPaymentMethodId = firstCard?.id || null;
      }
    }

    console.log('[DEBUG] About to create booking with paymentMethod:', paymentMethod);
    // Create booking with CONFIRMED status (no immediate payment)
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
        status: 'CONFIRMED', // Changed from PENDING
        paymentStatus: 'PENDING_PAYMENT', // New status for post-trip payment
        paymentMethod: paymentMethod,
        vehicleTypeId: validatedData.vehicleTypeId,
        ...(selectedPaymentMethodId && { savedPaymentMethodId: selectedPaymentMethodId })
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

    // Perform risk assessment
    try {
      const riskAssessment = await assessBookingRisk({
        userId: user.id,
        pickupAddress: validatedData.pickupAddress,
        dropoffAddress: validatedData.dropoffAddress,
        pickupTime,
        price,
        passengers: 1,
        distanceKm: Number(distanceKm.toFixed(2))
      });

      // Update booking with risk assessment
      await updateBookingRisk(booking.id, riskAssessment);

      console.log(`Risk assessment completed for booking ${booking.id}: ${riskAssessment.level} (${riskAssessment.score})`);
    } catch (riskError) {
      console.error('Error performing risk assessment:', riskError);
      // Don't fail the booking if risk assessment fails
    }

    // Send notification to admin (async, don't wait)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      // Fetch current cancellation fees from settings
      const settings = await prisma.settings.findFirst();

      const title = 'New scheduled booking (post-trip payment)';
      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(
          adminEmail,
          `${title} #${booking.id}`,
          `<p>New booking details (payment will be collected after trip completion):</p>
          <ul>
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Customer:</strong> ${(user as any).firstName} ${(user as any).lastName} (${(user as any).email})</li>
            <li><strong>Rider:</strong> ${booking.riderName}</li>
            <li><strong>Vehicle:</strong> ${(booking as any).vehicleType?.title || 'Standard'}</li>
            <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
            <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
            <li><strong>Time:</strong> ${booking.pickupTime.toISOString()}</li>
            <li><strong>Distance:</strong> ${booking.distanceKm} km</li>
            <li><strong>Duration:</strong> ${booking.durationMin} minutes</li>
            <li><strong>Price:</strong> ${booking.price} DKK</li>
            <li><strong>Payment Method:</strong> ${paymentMethod}</li>
            <li><strong>Status:</strong> CONFIRMED (payment pending after trip)</li>
          </ul>
          <h3>Cancellation Policy</h3>
          <p>Please inform the customer about our current cancellation policy:</p>
          <ul>
            <li><strong>More than 2 hours before pickup:</strong> ${settings?.scheduledCancellationFee1 || 0}% cancellation fee</li>
            <li><strong>1-2 hours before pickup:</strong> ${settings?.scheduledCancellationFee2 || 25}% cancellation fee</li>
            <li><strong>Less than 1 hour before pickup:</strong> ${settings?.scheduledCancellationFee3 || 50}% cancellation fee</li>
            <li><strong>After pickup time:</strong> No cancellation allowed</li>
          </ul>`
        )
      ).catch((error) => {
        console.error('[API] Failed to send admin notification:', error);
      });
    }

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
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        vehicleType: (booking as any).vehicleType || { title: 'Standard', capacity: 4 }
      },
      message: 'Booking confirmed successfully. Payment will be collected after trip completion.'
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error creating booking:', error);
    console.error('[API] Error stack:', (error as any)?.stack);

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