import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, retrieveCheckoutSession } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { notifyBookingConfirmedUnified } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    let event;
    try {
      event = constructWebhookEvent(Buffer.from(body), signature);
    } catch (err) {
      console.error('[Stripe Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const source = session.metadata?.source;

      if (!bookingId || source !== 'whatsapp') {
        return NextResponse.json({ received: true });
      }

      console.log(`[Stripe Webhook] WhatsApp booking #${bookingId} paid via checkout`);

      const booking = await (prisma as any).ride.findUnique({
        where: { id: parseInt(bookingId) },
        select: { id: true, status: true, price: true, userId: true, paymentMethod: true },
      });

      if (!booking) {
        console.error(`[Stripe Webhook] Booking #${bookingId} not found`);
        return NextResponse.json({ received: true });
      }

      // Update booking as paid
      await (prisma as any).ride.update({
        where: { id: booking.id },
        data: {
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          paymentMethod: 'card',
          paymentRef: session.id,
          explanation: 'Paid via WhatsApp - Stripe checkout',
        },
      });

      // Get user for notification
      const user = await prisma.user.findUnique({
        where: { id: booking.userId },
        select: { email: true, firstName: true },
      });

      if (user) {
        notifyBookingConfirmedUnified(
          { id: booking.userId, email: user.email, firstName: user.firstName },
          { id: booking.id, pickupTime: new Date().toISOString(), riderName: user.firstName,
            pickupAddress: '', dropoffAddress: '', price: booking.price, vehicleTypeId: 1 }
        ).catch(() => {});
      }

      // Send WhatsApp confirmation
      const userPhone = session.metadata?.userPhone;
      if (userPhone) {
        try {
          const { sendEmail } = await import('@/lib/email');
          // Note: we can't easily send WhatsApp from here without duplicating the send function
          console.log(`[Stripe Webhook] Payment confirmed for WhatsApp user ${userPhone}, booking #${booking.id}`);
        } catch {}
      }

      // Notify driver dispatch (trigger driver assignment)
      if ((global as any).checkForNewRides) {
        (global as any).checkForNewRides();
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}