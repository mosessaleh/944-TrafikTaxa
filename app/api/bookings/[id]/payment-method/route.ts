import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { notifyUserInvoiceReady } from '@/lib/notify';
import { authorizeCardPayment } from '@/lib/payment-processor';
import { sendEmail } from '@/lib/email';

const ALLOWED_PAYMENT_METHODS = new Set(['invoice', 'card', 'cash', 'paypal', 'revolut', 'crypto']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse booking ID
    const { id } = await params;
    const bookingId = parseInt(id);
    if (isNaN(bookingId) || bookingId <= 0) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    // 3. Parse request body
    const requestBody = await request.json();
    const { paymentMethod } = requestBody;

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method required' }, { status: 400 });
    }

    if (!ALLOWED_PAYMENT_METHODS.has(String(paymentMethod))) {
      return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
    }

    // 4. Check booking exists
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, status: true, paymentStatus: true, paymentMethod: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // 5. Check authorization
    const isAdmin = me.type === 'user' && (me as any).role === 'ADMIN';
    if (booking.userId !== me.id && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const statusUpper = String(booking.status || '').toUpperCase();
    const immutableStatuses = new Set([
      'CANCELED',
      'COMPLETED',
      'REFUNDED',
      'DELIVERED',
      'PICKED_UP',
      'ONGOING',
      'DISPATCHED',
      'IN_PROGRESS'
    ]);

    if (immutableStatuses.has(statusUpper)) {
      return NextResponse.json({
        error: 'Cannot change payment method for this booking status'
      }, { status: 400 });
    }

    if (paymentMethod === 'invoice' && booking.paymentMethod === 'invoice') {
      return NextResponse.json({ error: 'Invoice payment already configured for this booking' }, { status: 409 });
    }

    if (paymentMethod === 'card' && booking.paymentMethod === 'card') {
      return NextResponse.json({ error: 'Card payment already configured for this booking' }, { status: 409 });
    }

    if (booking.paymentMethod && booking.paymentMethod !== paymentMethod && !isAdmin) {
      return NextResponse.json({
        error: 'Payment method cannot be changed after selection'
      }, { status: 409 });
    }

    // 6. Handle different payment methods
    let updatedBooking;
    
    if (paymentMethod === 'invoice') {
      // Check invoice permissions
      if (!(me as any).canPayByInvoice && !isAdmin) {
        return NextResponse.json({
          error: 'Invoice payment not available for your account'
        }, { status: 403 });
      }

      // Get full booking details
      const fullBooking = await prisma.ride.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          vehicleType: true
        }
      });

      if (!fullBooking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      // Create invoice number in agreed format TUR-000023
      const invoiceNumber = `TUR-${fullBooking.id.toString().padStart(6, '0')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 8);

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          userId: fullBooking.userId,
          rideId: fullBooking.id,
          dueDate,
          paymentStatus: 'UNPAID',
          status: 1
        }
      });
      console.log(`[DEBUG] Invoice ${invoiceNumber} created for booking ${bookingId}`);

      // Update booking
      const invoiceUpdateData: any = {
        paymentMethod: 'invoice',
        paymentStatus: 'PENDING_PAYMENT'
      };

      if (statusUpper === 'PENDING') {
        invoiceUpdateData.status = 'CONFIRMED';
        invoiceUpdateData.explanation = 'Waiting to send a car';
      }

      updatedBooking = await prisma.ride.update({
        where: { id: bookingId },
        data: invoiceUpdateData,
        include: {
          vehicleType: {
            select: {
              title: true,
              capacity: true
            }
          }
        }
      });


      // Send email (non-critical)
      try {
        await notifyUserInvoiceReady(fullBooking.user.email, fullBooking.user.firstName, {
          bookingId: fullBooking.id,
          price: fullBooking.price,
        }, invoice.id);
      } catch (emailError) {
        console.error('Email send failed (non-critical):', emailError instanceof Error ? emailError.message : 'Unknown error');
      }

    } else if (paymentMethod === 'card' && !booking.paymentMethod) {
      // Special handling for card payment when booking was created without payment method

      // Get user's default card payment method
      const defaultCard = await prisma.userPaymentMethod.findFirst({
        where: {
          userId: me.id,
          type: 'card',
          isActive: true,
          isDefault: true
        }
      });

      if (!defaultCard) {
        return NextResponse.json({
          error: 'No default card payment method found. Please add a card first.'
        }, { status: 400 });
      }

      // Get full booking details for authorization
      const fullBooking = await prisma.ride.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          vehicleType: true
        }
      });

      if (!fullBooking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      // Authorize the payment (reserve funds)
      const authResult = await authorizeCardPayment(fullBooking, defaultCard);

      if (!authResult.success) {
        return NextResponse.json({
          error: `Card authorization failed: ${authResult.error}`,
          requiresAction: authResult.requiresAction,
          actionUrl: authResult.actionUrl
        }, { status: 400 });
      }

      // Update booking with payment method and status
      try {
        const cardUpdateData: any = {
          paymentMethod: 'card',
          paymentStatus: 'PENDING_PAYMENT',
          savedPaymentMethodId: defaultCard.id,
          explanation: `Payment authorized - Transaction: ${authResult.transactionId}`
        };

        if (statusUpper === 'PENDING') {
          cardUpdateData.status = 'CONFIRMED';
        }

        updatedBooking = await prisma.ride.update({
          where: { id: bookingId },
          data: cardUpdateData,
          include: {
            vehicleType: {
              select: {
                title: true,
                capacity: true
              }
            }
          }
        });
        console.log('✅ Booking updated with card payment method');

      } catch (updateError) {
        console.error('❌ Booking update failed:', updateError);
        return NextResponse.json({
          error: 'Failed to update booking',
          details: updateError instanceof Error ? updateError.message : 'Unknown error'
        }, { status: 500 });
      }

      // Send booking confirmation email
      try {
        const subject = `Booking Confirmed - #${fullBooking.id}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">Booking Confirmed! ✅</h2>
            <p>Dear ${fullBooking.user.firstName} ${fullBooking.user.lastName},</p>
            <p>Your booking has been confirmed and payment has been authorized.</p>

            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Booking Details:</h3>
              <ul>
                <li><strong>Booking ID:</strong> ${fullBooking.id}</li>
                <li><strong>Pickup:</strong> ${fullBooking.pickupAddress}</li>
                <li><strong>Dropoff:</strong> ${fullBooking.dropoffAddress}</li>
                <li><strong>Time:</strong> ${new Date(fullBooking.pickupTime).toLocaleString()}</li>
                <li><strong>Vehicle:</strong> ${fullBooking.vehicleType?.title || 'Standard'}</li>
                <li><strong>Price:</strong> ${fullBooking.price} DKK</li>
                <li><strong>Payment Method:</strong> Card (Authorized)</li>
              </ul>
            </div>

            <p><strong>Important:</strong> Your card has been authorized for this amount and will be captured after trip completion.</p>

            <p>If you have any questions, please contact our support team.</p>

            <p>Thank you for choosing 944 Trafik!</p>
          </div>
        `;

        await sendEmail(fullBooking.user.email, subject, html);
      } catch (emailError) {
        console.error('Email send failed (non-critical):', emailError instanceof Error ? emailError.message : 'Unknown error');
      }

    } else {
      if (paymentMethod === 'card') {
        return NextResponse.json({
          error: 'Card payment method cannot be reassigned through this endpoint'
        }, { status: 400 });
      }

      // Other payment methods (paypal, revolut, etc.)
      updatedBooking = await prisma.ride.update({
        where: { id: bookingId },
        data: { paymentMethod },
        include: {
          vehicleType: {
            select: {
              title: true,
              capacity: true
            }
          }
        }
      });
    }
    return NextResponse.json({
      success: true,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        paymentStatus: updatedBooking.paymentStatus,
        paymentMethod: updatedBooking.paymentMethod
      }
    });

  } catch (error) {
    console.error('💥 payment-method API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
