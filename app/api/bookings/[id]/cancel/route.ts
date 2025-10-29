import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/bookings/[id]/cancel - Cancel a booking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid booking ID' },
        { status: 400 }
      );
    }

    // Find the booking and verify ownership
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      include: {
        vehicleType: {
          select: {
            title: true,
            capacity: true
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    if (booking.userId !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized to cancel this booking' },
        { status: 403 }
      );
    }

    // Check if booking can be cancelled
    if (booking.status === 'CANCELED') {
      return NextResponse.json(
        { ok: false, error: 'Booking is already cancelled' },
        { status: 400 }
      );
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { ok: false, error: 'Cannot cancel a completed booking' },
        { status: 400 }
      );
    }

    // Calculate cancellation fee based on booking type and time remaining
    const pickupTime = new Date(booking.pickupTime);
    const now = new Date();
    const timeDiffMs = pickupTime.getTime() - now.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    let cancellationFee = 0;
    let refundAmount = booking.price;

    if (booking.scheduled) {
      // Scheduled bookings: time-based cancellation fees
      if (timeDiffHours >= 2) {
        // More than 2 hours: no fee
        cancellationFee = 0;
      } else if (timeDiffHours >= 1) {
        // 1-2 hours: 25% fee
        cancellationFee = Math.round((booking.price * 25) / 100);
      } else if (timeDiffHours > 0) {
        // Less than 1 hour: 50% fee
        cancellationFee = Math.round((booking.price * 50) / 100);
      } else {
        // Past pickup time: cannot cancel
        return NextResponse.json(
          { ok: false, error: 'Cannot cancel booking after pickup time' },
          { status: 400 }
        );
      }
    } else {
      // Immediate bookings: fixed 100 DKK cancellation fee
      // Allow cancellation even if pickup has started for immediate bookings
      cancellationFee = Math.min(100, booking.price); // Don't charge more than booking amount
    }

    refundAmount = booking.price - cancellationFee;

    // Update booking status to cancelled
    const updatedBooking = await prisma.ride.update({
      where: { id: bookingId },
      data: { status: 'CANCELED' }
    });

    // Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      try {
        await sendEmail(
          adminEmail,
          `Booking Cancellation #${booking.id}`,
          `<p>A customer has cancelled their booking:</p>
          <ul>
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Customer:</strong> ${user.firstName} ${user.lastName} (${user.email})</li>
            <li><strong>Rider:</strong> ${booking.riderName}</li>
            <li><strong>Vehicle:</strong> ${booking.vehicleType.title}</li>
            <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
            <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
            <li><strong>Time:</strong> ${booking.pickupTime.toISOString()}</li>
            <li><strong>Original Price:</strong> ${booking.price} DKK</li>
            <li><strong>Cancellation Fee:</strong> ${cancellationFee} DKK</li>
            <li><strong>Refund Amount:</strong> ${refundAmount} DKK</li>
            <li><strong>Paid:</strong> ${booking.paid ? 'Yes' : 'No'}</li>
          </ul>
          <p>Please process the refund if payment was made.</p>`
        );
      } catch (emailError) {
        console.error('[API] Failed to send cancellation email to admin:', emailError);
      }
    }

    // Send confirmation email to user
    try {
      await sendEmail(
        user.email,
        'Booking Cancellation Confirmation',
        `<p>Dear ${user.firstName},</p>
        <p>Your booking has been successfully cancelled.</p>
        <ul>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
          <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
          <li><strong>Time:</strong> ${booking.pickupTime.toISOString()}</li>
          <li><strong>Original Amount:</strong> ${booking.price} DKK</li>
          <li><strong>Cancellation Fee:</strong> ${cancellationFee} DKK</li>
          <li><strong>Refund Amount:</strong> ${refundAmount} DKK</li>
        </ul>
        ${booking.paid ?
          `<p><strong>Refund Information:</strong> Your refund of ${refundAmount} DKK will be processed within 3-5 business days. The refund will be processed to the original payment method.</p>` :
          '<p>No payment was made for this booking.</p>'
        }
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>944 Trafik Team</p>`
      );
    } catch (emailError) {
      console.error('[API] Failed to send confirmation email to user:', emailError);
    }

    return NextResponse.json({
      ok: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status
      }
    });

  } catch (error) {
    console.error('[API] Error cancelling booking:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}