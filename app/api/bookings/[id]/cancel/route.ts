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

    // Fetch cancellation fees from settings
    const settings = await prisma.settings.findFirst();
    if (!settings) {
      return NextResponse.json(
        { ok: false, error: 'System settings not found' },
        { status: 500 }
      );
    }

    // Calculate cancellation fee based on booking type and time remaining
    const pickupTime = new Date(booking.pickupTime);
    const now = new Date();
    const timeDiffMs = pickupTime.getTime() - now.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    const timeDiffMinutes = timeDiffMs / (1000 * 60);

    let cancellationFee = 0;
    let refundAmount = booking.price;

    if (booking.scheduled) {
      // Scheduled bookings: time-based cancellation fees with 15-minute grace period
      if (timeDiffMinutes <= 15) {
        // Within 15 minutes: can cancel for free
        cancellationFee = 0;
      } else if (timeDiffHours >= 2) {
        // More than 2 hours: use database fee (usually 0%)
        cancellationFee = Math.round((booking.price * settings.scheduledCancellationFee1) / 100);
      } else if (timeDiffHours >= 1) {
        // 1-2 hours: use database fee (usually 25%)
        cancellationFee = Math.round((booking.price * settings.scheduledCancellationFee2) / 100);
      } else if (timeDiffHours > 0) {
        // Less than 1 hour: use database fee (usually 50%)
        cancellationFee = Math.round((booking.price * settings.scheduledCancellationFee3) / 100);
      } else {
        // Past pickup time: cannot cancel
        return NextResponse.json(
          { ok: false, error: 'Cannot cancel booking after pickup time' },
          { status: 400 }
        );
      }
    } else {
      // Immediate bookings: use database fee (usually 50 DKK)
      if (booking.status === 'DISPATCHED' || booking.status === 'ONGOING') {
        // Car has been dispatched: use database fee
        cancellationFee = Math.min(settings.immediateCancellationFee, booking.price);
      } else {
        // Before dispatch: no fee
        cancellationFee = 0;
      }
    }

    refundAmount = booking.price - cancellationFee;

    // Update booking status to cancelled
    const updatedBooking = await prisma.ride.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELED'
      }
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
            <li><strong>Payment Status:</strong> ${booking.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}</li>
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
        <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0; color: #333;">Cancellation Details:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
            <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
            <li><strong>Scheduled Time:</strong> ${new Date(booking.pickupTime).toLocaleString('en-DK')}</li>
            <li><strong>Original Amount:</strong> ${booking.price} DKK</li>
            ${cancellationFee > 0 ? `<li><strong>Cancellation Fee:</strong> ${cancellationFee} DKK</li>` : ''}
            ${refundAmount > 0 ? `<li><strong>Refund Amount:</strong> ${refundAmount} DKK</li>` : ''}
          </ul>
        </div>
        ${booking.paymentStatus === 'PAID' ?
           `<p><strong>Refund Information:</strong> ${refundAmount > 0 ? `Your refund of ${refundAmount} DKK will be processed within 3-5 business days. The refund will be processed to the original payment method.` : 'No refund is applicable for this cancellation.'}</p>` :
           '<p>No payment was made for this booking.</p>'
         }
        <p>If you have any questions about this cancellation, please contact our support team.</p>
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