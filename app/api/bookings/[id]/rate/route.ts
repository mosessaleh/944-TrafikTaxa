import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createNotification } from '@/lib/notification-service';

const prismaAny = prisma as any;

const RatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().trim().max(500).optional().nullable(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.type !== 'user') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = Number(params.id);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid booking ID' }, { status: 400 });
    }

    const body = RatingSchema.parse(await request.json());

    const booking = await prismaAny.ride.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        driverId: true,
        customerRating: true,
      },
    });

    if (!booking || booking.userId !== user.id) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
    }

    if (String(booking.status).toUpperCase() !== 'COMPLETED') {
      return NextResponse.json({ ok: false, error: 'Only completed rides can be rated' }, { status: 400 });
    }

    if (!booking.driverId) {
      return NextResponse.json({ ok: false, error: 'This ride has no assigned driver to rate' }, { status: 400 });
    }

    if (booking.customerRating) {
      return NextResponse.json({ ok: false, error: 'This ride has already been rated' }, { status: 409 });
    }

    const [updatedRide, driver] = await prismaAny.$transaction(async (tx: any) => {
      const nextRide = await tx.ride.update({
        where: { id: bookingId },
        data: {
          customerRating: body.rating,
          customerReview: body.review?.trim() ? body.review.trim() : null,
          customerRatedAt: new Date(),
        },
        select: {
          id: true,
          customerRating: true,
          customerReview: true,
          customerRatedAt: true,
          driverId: true,
        },
      });

      const currentDriver = await tx.comDriver.findUnique({
        where: { id: booking.driverId! },
        select: {
          id: true,
          rating: true,
          drFname: true,
        },
      });

      if (!currentDriver) {
        return [nextRide, null] as const;
      }

      const currentRating = Number(currentDriver.rating || 5);
      const nextRating = Number((((currentRating * 4) + body.rating) / 5).toFixed(2));

      const updatedDriver = await tx.comDriver.update({
        where: { id: currentDriver.id },
        data: { rating: nextRating },
        select: {
          id: true,
          rating: true,
          drFname: true,
        },
      });

      return [nextRide, updatedDriver] as const;
    });

    if (driver) {
      createNotification(user.id, {
        type: 'ride_rated',
        title: 'Thanks for your feedback',
        body: `You rated driver ${driver.drFname || '#' + driver.id} with ${body.rating}/5 stars.`,
        data: {
          bookingId,
          driverId: driver.id,
          rating: body.rating,
        },
      }).catch((error) => {
        console.error('[API] Failed to create rating notification:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      rating: {
        bookingId: updatedRide.id,
        customerRating: updatedRide.customerRating,
        customerReview: updatedRide.customerReview,
        customerRatedAt: updatedRide.customerRatedAt?.toISOString() || null,
      },
      driver: driver
        ? {
            id: driver.id,
            rating: Number(driver.rating || 0),
          }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message || 'Invalid rating payload' }, { status: 400 });
    }

    console.error('[API] Error rating booking:', error);
    return NextResponse.json({ ok: false, error: 'Failed to rate booking' }, { status: 500 });
  }
}
