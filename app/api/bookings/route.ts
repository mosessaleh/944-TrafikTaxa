import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitize';
import { assessBookingRisk, updateBookingRisk } from '@/lib/risk-assessment';
import { calculateDistance } from '@/lib/distance';
import { authorizeCardPayment } from '@/lib/payment-processor';
import { notifyBookingConfirmedUnified } from '@/lib/notification-service';

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
  stopAddress: z.string()
    .min(3, "Stop address must be at least 3 characters")
    .max(500, "Stop address is too long")
    .optional()
    .nullable(),
  pickupLat: z.number().min(-90).max(90).optional().nullable(),
  pickupLon: z.number().min(-180).max(180).optional().nullable(),
  stopLat: z.number().min(-90).max(90).optional().nullable(),
  stopLon: z.number().min(-180).max(180).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional().nullable(),
  dropoffLon: z.number().min(-180).max(180).optional().nullable(),
  vehicleTypeId: z.number().int().positive("Invalid vehicle type"),
  scheduled: z.boolean(),
  pickupTime: z.string(),
}).superRefine((data, ctx) => {
  const now = new Date();
  const maxFuture = new Date();
  maxFuture.setDate(now.getDate() + 90);

  const hasStopAddress = Boolean(data.stopAddress && data.stopAddress.trim());
  const hasStopCoords = data.stopLat !== null && data.stopLat !== undefined
    || data.stopLon !== null && data.stopLon !== undefined;

  if (hasStopCoords && !hasStopAddress) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stopAddress'],
      message: 'Stop address is required when stop coordinates are provided'
    });
  }

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

    if (user.type === 'user' && !((user as any).emailVerified) && (user as any).role !== 'ADMIN') {
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
        stopAddress: true,
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
        driverId: true,
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
         stopAddress: booking.stopAddress,
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

    if (user.type === 'user' && !((user as any).emailVerified) && (user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Email verification required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const rawData = await request.json();

    // Sanitize inputs before validation
    const sanitizedStopAddress = typeof rawData.stopAddress === 'string'
      ? sanitizeInput(rawData.stopAddress, 'address')
      : '';

    const sanitizedData = {
      riderName: sanitizeInput(rawData.riderName, 'text'),
      pickupAddress: sanitizeInput(rawData.pickupAddress, 'address'),
      dropoffAddress: sanitizeInput(rawData.dropoffAddress, 'address'),
      stopAddress: sanitizedStopAddress ? sanitizedStopAddress : null,
      pickupLat: rawData.pickupLat ? parseFloat(rawData.pickupLat) : null,
      pickupLon: rawData.pickupLon ? parseFloat(rawData.pickupLon) : null,
      stopLat: rawData.stopLat ? parseFloat(rawData.stopLat) : null,
      stopLon: rawData.stopLon ? parseFloat(rawData.stopLon) : null,
      dropoffLat: rawData.dropoffLat ? parseFloat(rawData.dropoffLat) : null,
      dropoffLon: rawData.dropoffLon ? parseFloat(rawData.dropoffLon) : null,
      vehicleTypeId: parseInt(rawData.vehicleTypeId),
      scheduled: rawData.scheduled === 'true' || rawData.scheduled === true,
      pickupTime: rawData.pickupTime, // Keep as string for date validation
      longWaitAccepted: rawData.longWaitAccepted === 'true' || rawData.longWaitAccepted === true
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


    // Check payment method requirements - validation moved to client side
    const paymentMethod = rawData.paymentMethod; // No default, allow null

    // Calculate distance and duration
    console.log('[DEBUG] Calculating distance for booking:', {
      pickup: {
        address: validatedData.pickupAddress,
        lat: validatedData.pickupLat,
        lon: validatedData.pickupLon
      },
      stop: validatedData.stopAddress ? {
        address: validatedData.stopAddress,
        lat: validatedData.stopLat,
        lon: validatedData.stopLon
      } : null,
      dropoff: {
        address: validatedData.dropoffAddress,
        lat: validatedData.dropoffLat,
        lon: validatedData.dropoffLon
      }
    });

    let distanceKm: number, durationMin: number;
    try {
      if (validatedData.stopAddress) {
        const firstLeg = await safeEstimateDistance(
          {
            address: validatedData.pickupAddress,
            lat: validatedData.pickupLat || null,
            lon: validatedData.pickupLon || null
          },
          {
            address: validatedData.stopAddress,
            lat: validatedData.stopLat || null,
            lon: validatedData.stopLon || null
          }
        );
        const secondLeg = await safeEstimateDistance(
          {
            address: validatedData.stopAddress,
            lat: validatedData.stopLat || null,
            lon: validatedData.stopLon || null
          },
          {
            address: validatedData.dropoffAddress,
            lat: validatedData.dropoffLat || null,
            lon: validatedData.dropoffLon || null
          }
        );
        distanceKm = firstLeg.distanceKm + secondLeg.distanceKm;
        durationMin = firstLeg.durationMin + secondLeg.durationMin;
      } else {
        const result = await safeEstimateDistance(
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
        distanceKm = result.distanceKm;
        durationMin = result.durationMin;
      }
    } catch (error: any) {
      console.error('[API] Distance calculation failed:', error);
      return NextResponse.json(
        { ok: false, error: 'Unable to calculate route for the selected addresses. Please choose different pickup and dropoff locations.' },
        { status: 400 }
      );
    }

    console.log('[DEBUG] Distance calculation result:', { distanceKm, durationMin });

    // Check minimum distance
    if (distanceKm < 0.1) {
      return NextResponse.json(
        { ok: false, error: 'Pickup and dropoff locations are too close. Please choose different addresses.' },
        { status: 400 }
      );
    }

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

    // Initialize driver queue (will be populated during vehicle assignment)
    let driverQueue: string[] = [];

    // Create booking with PENDING status (awaiting payment confirmation)
    console.log(`[DEBUG] Creating booking with status PENDING for user ${user.id}`);
    const booking = await prisma.ride.create({
      data: {
        userId: user.id,
        riderName: validatedData.riderName,
        passengers: 1,
        pickupAddress: validatedData.pickupAddress,
        dropoffAddress: validatedData.dropoffAddress,
        stopAddress: validatedData.stopAddress || null,
        startLatLon: validatedData.pickupLat && validatedData.pickupLon ? { lat: validatedData.pickupLat, lon: validatedData.pickupLon } : null,
        stopLatLon: validatedData.stopLat && validatedData.stopLon ? { lat: validatedData.stopLat, lon: validatedData.stopLon } : null,
        endLatLon: validatedData.dropoffLat && validatedData.dropoffLon ? { lat: validatedData.dropoffLat, lon: validatedData.dropoffLon } : null,
        scheduled: validatedData.scheduled,
        pickupTime,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin,
        price,
        status: 'PENDING', // Awaiting payment confirmation
        paymentStatus: 'UNPAID', // Awaiting payment method selection
        paymentMethod: paymentMethod,
        vehicleTypeId: validatedData.vehicleTypeId,
        driverQueue,
        ...(selectedPaymentMethodId && { savedPaymentMethodId: selectedPaymentMethodId })
      } as any,
      include: {
        vehicleType: {
          select: {
            title: true,
            capacity: true
          }
        }
      }
    });
    console.log(`[DEBUG] Booking ${booking.id} created with status PENDING`);

    // Send booking confirmation notification (fire-and-forget)
    notifyBookingConfirmedUnified(
      { id: user.id, email: (user as any).email, firstName: (user as any).firstName },
      {
        id: booking.id,
        pickupTime: booking.pickupTime.toISOString(),
        riderName: booking.riderName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        price: booking.price,
        vehicleTypeId: booking.vehicleTypeId
      }
    ).catch((error) => {
      console.error('[API] Failed to send booking confirmation notification:', error);
    });

    // Vehicle assignment will be done after payment confirmation
    // No vehicle selection or driver assignment at booking creation

    // Perform risk assessment (fire-and-forget)
    assessBookingRisk({
      userId: user.id,
      pickupAddress: validatedData.pickupAddress,
      dropoffAddress: validatedData.dropoffAddress,
      pickupTime,
      price,
      passengers: 1,
      distanceKm: Number(distanceKm.toFixed(2))
    }).then(async (riskAssessment) => {
      try {
        // Update booking with risk assessment
        await updateBookingRisk(booking.id, riskAssessment);
        console.log(`Risk assessment completed for booking ${booking.id}: ${riskAssessment.level} (${riskAssessment.score})`);
      } catch (updateError) {
        console.error('Error updating booking with risk assessment:', updateError);
      }
    }).catch((riskError) => {
      console.error('Error performing risk assessment:', riskError);
    });

    // Authorize card payment if card payment method is selected
    if (paymentMethod === 'card' && selectedPaymentMethodId) {
      try {
        console.log(`[DEBUG] Authorizing card payment for booking ${booking.id}, selectedPaymentMethodId: ${selectedPaymentMethodId}`);

        // Get the payment method details
        const paymentMethodDetails = await prisma.userPaymentMethod.findUnique({
          where: { id: selectedPaymentMethodId },
          select: { id: true, token: true, provider: true, type: true }
        });

        console.log(`[DEBUG] Payment method details:`, paymentMethodDetails);

        if (!paymentMethodDetails || paymentMethodDetails.provider !== 'stripe') {
          console.error(`[DEBUG] Invalid payment method for booking ${booking.id}: ${JSON.stringify(paymentMethodDetails)}`);
        } else {
          // Authorize the payment (reserve funds)
          const authResult = await authorizeCardPayment(booking, paymentMethodDetails);

          console.log(`[DEBUG] Authorization result:`, authResult);

          if (authResult.success) {
            // Update booking with payment capture
            await prisma.ride.update({
              where: { id: booking.id },
              data: {
                status: 'CONFIRMED',
                // paymentStatus is set by authorizeCardPayment
                explanation: `Payment authorized - Transaction: ${authResult.transactionId}`,
                paymentRef: authResult.transactionId // Store Payment Intent ID
              }
            });

            console.log(`[DEBUG] Payment authorized for booking ${booking.id}, transaction: ${authResult.transactionId}`);

            // Send booking confirmation notification
            await notifyBookingConfirmedUnified(
              { id: user.id, email: (user as any).email, firstName: (user as any).firstName },
              {
                id: booking.id,
                pickupTime: booking.pickupTime.toISOString(),
                riderName: booking.riderName,
                pickupAddress: booking.pickupAddress,
                dropoffAddress: booking.dropoffAddress,
                price: booking.price,
                vehicleTypeId: booking.vehicleTypeId
              }
            );

            // Check for new rides after confirmation
            if ((global as any).checkForNewRides) {
              (global as any).checkForNewRides();
            }
          } else {
            console.error(`[DEBUG] Payment authorization failed for booking ${booking.id}: ${authResult.error}`);
            // Keep booking as PENDING, payment method will be handled later
          }
        }
      } catch (authError) {
        console.error(`[DEBUG] Exception during payment authorization for booking ${booking.id}:`, authError);
        // Don't fail the booking if payment authorization fails
      }
    } else {
      console.log(`[DEBUG] Not authorizing payment: paymentMethod=${paymentMethod}, selectedPaymentMethodId=${selectedPaymentMethodId}`);
    }

    // Get updated booking status
    const updatedBooking = await prisma.ride.findUnique({
      where: { id: booking.id },
      select: {
        status: true,
        paymentStatus: true,
        explanation: true
      }
    });

    // Send notification to admin (async, don't wait)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      // Fetch current cancellation fees from settings
      const settings = await prisma.settings.findFirst();

      const isPaymentAuthorized = updatedBooking?.status === 'CONFIRMED';
      const title = isPaymentAuthorized ? 'New booking (payment authorized)' : 'New scheduled booking (post-trip payment)';
      const paymentNote = isPaymentAuthorized
        ? 'Payment has been authorized and a driver has been assigned. Payment will be captured upon trip completion.'
        : 'Payment will be collected after trip completion.';

      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(
          adminEmail,
          `${title} #${booking.id}`,
          `<p>New booking details (${paymentNote}):</p>
          <ul>
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Customer:</strong> ${(user as any).firstName} ${(user as any).lastName} (${(user as any).email})</li>
            <li><strong>Rider:</strong> ${booking.riderName}</li>
            <li><strong>Vehicle:</strong> ${(booking as any).vehicleType?.title || 'Standard'}</li>
            <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
            ${booking.stopAddress ? `<li><strong>Stop:</strong> ${booking.stopAddress}</li>` : ''}
            <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
            <li><strong>Time:</strong> ${booking.pickupTime.toISOString()}</li>
            <li><strong>Distance:</strong> ${booking.distanceKm} km</li>
            <li><strong>Duration:</strong> ${booking.durationMin} minutes</li>
            <li><strong>Price:</strong> ${booking.price} DKK</li>
            <li><strong>Payment Method:</strong> ${paymentMethod}</li>
            <li><strong>Status:</strong> ${updatedBooking?.status || 'PENDING'} (${updatedBooking?.explanation || 'awaiting payment confirmation'})</li>
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

    const message = updatedBooking?.status === 'CONFIRMED'
      ? 'Booking confirmed successfully. Payment has been authorized and a driver will be assigned. Payment will be captured upon trip completion.'
      : 'Booking created successfully. Payment will be collected after trip completion.';

    return NextResponse.json({
      ok: true,
      ride: {
        id: booking.id,
        riderName: booking.riderName,
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        stopAddress: booking.stopAddress || null,
        pickupTime: booking.pickupTime.toISOString(),
        price: booking.price,
        status: updatedBooking?.status || booking.status,
        paymentStatus: updatedBooking?.paymentStatus || booking.paymentStatus,
        paymentMethod: booking.paymentMethod,
        vehicleType: (booking as any).vehicleType || { title: 'Standard', capacity: 4 }
      },
      message
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error creating booking:', error);
    console.error('[API] Error stack:', (error as any)?.stack);
    console.error('[API] Error message:', (error as any)?.message);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Could not place booking. Please refine addresses and try again.', details: (error as any)?.message },
      { status: 400 }
    );
  }
}
