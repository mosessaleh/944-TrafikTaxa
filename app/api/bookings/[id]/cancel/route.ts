import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { getSocketServer } from '@/lib/socket-server';
import { chargeCancellationFee } from '@/lib/payment-processor';

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

    if (user.type === 'user' && !(user as any).emailVerified) {
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

    // Parse optional body for reason
    let cancelReason: string | undefined;
    try {
      const body = await request.json().catch(() => null);
      if (body && typeof body.reason === 'string') {
        cancelReason = body.reason.slice(0, 255);
      }
    } catch (e) {
      // ignore body parse errors (backward compatible)
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

    // Default payment status/result before payment ops
    let paymentStatus: string | null = booking.paymentStatus;
    let paymentRef: string | null | undefined = booking.paymentRef;
    let paymentExplanation: string | null = booking.explanation;
    let refundId: string | undefined;

    // Process payment adjustments (refund or cancel auth or charge fee if needed)
    if (booking.paymentMethod === 'card' && booking.savedPaymentMethodId && booking.paymentStatus) {
      const paymentResult = await chargeCancellationFee(
        {
          ...booking,
          savedPaymentMethod: await prisma.userPaymentMethod.findUnique({
            where: { id: booking.savedPaymentMethodId }
          })
        },
        cancellationFee,
        booking.price
      );

      if (paymentResult.success) {
        paymentStatus = cancellationFee > 0 ? 'PAID' : 'REFUNDED';
        paymentRef = paymentResult.transactionId || paymentRef;
        refundId = paymentResult.refundId;
        paymentExplanation = paymentResult.refundId
          ? `Cancellation refund ${paymentResult.refundedAmountDkk} DKK, refundId=${paymentResult.refundId}`
          : paymentResult.canceledAuthorization
            ? 'Authorization canceled - no cancellation fee'
            : paymentResult.transactionId
              ? `Cancellation fee charged - tx=${paymentResult.transactionId}`
              : booking.explanation;
      } else {
        paymentStatus = cancellationFee > 0 ? 'UNPAID' : booking.paymentStatus;
        paymentExplanation = `Cancellation payment handling failed: ${paymentResult.error || 'unknown error'}`;
      }
    }

    // Update booking status to cancelled and persist payment updates
    const updatedBooking = await prisma.ride.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELED',
        canceledBy: 'user',
        cancellationReason: cancelReason || null,
        paymentStatus: paymentStatus || undefined,
        paymentRef: paymentRef || undefined,
        explanation: paymentExplanation || undefined
      }
    });

    const io = getSocketServer();

    const scheduledOffers = (global as any).scheduledOffers as Map<number, any> | undefined;
    if (scheduledOffers?.has(bookingId)) {
      const offerState = scheduledOffers.get(bookingId);
      if (offerState?.timerId) {
        clearTimeout(offerState.timerId);
      }
      scheduledOffers.delete(bookingId);
      if (io && offerState?.candidates?.length) {
        offerState.candidates.forEach((candidate: any) => {
          io.to(`driver_${candidate.driverId}`).emit('rideCancelled', { rideId: bookingId });
        });
      }
    }

    if (io && booking.driverId) {
      io.to(`driver_${booking.driverId}`).emit('rideCancelled', {
        rideId: bookingId
      });
    }

    if (booking.driverId) {
      const driverRecord = await prisma.comDriver.findUnique({
        where: { id: booking.driverId },
        select: { currentRideId: true }
      });

      if (driverRecord?.currentRideId === bookingId) {
        await prisma.comDriver.update({
          where: { id: booking.driverId },
          data: {
            currentRideId: null,
            isBusy: false,
            rideAccepted: 0
          }
        });
      }
    }

    // Notify driver if ride was offered to them
    if (io && (global as any).activeOffers?.has(bookingId)) {
      const driverId = (global as any).activeOffers.get(bookingId);
      console.log(`Notifying driver ${driverId} that ride ${bookingId} was cancelled`);

      // Send cancellation event to clear the offer on driver's screen
      io.to(`driver_${driverId}`).emit('rideCancelled', {
        rideId: bookingId
      });

      // Remove from active offers
      (global as any).activeOffers.delete(bookingId);
    }

    if (typeof (global as any).checkForNewRides === 'function') {
      (global as any).checkForNewRides().catch((error: any) => {
        console.error('[API] Failed to refresh ride offers after cancellation:', error);
      });
    }

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
            <li><strong>Customer:</strong> ${(user as any).firstName} ${(user as any).lastName} (${(user as any).email})</li>
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
        (user as any).email,
        'Booking Cancellation Confirmation',
        `<p>Dear ${(user as any).firstName},</p>
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
        status: updatedBooking.status,
        cancellationFee,
        refundAmount,
        paymentStatus: paymentStatus || booking.paymentStatus,
        paymentRef,
        refundId,
        canceledBy: 'user',
        cancellationReason: cancelReason || null
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
