import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { retrievePaymentIntent } from "@/lib/stripe";
import { ConfirmCardPaymentSchema } from "@/lib/validation";
import { notifyUserPaymentReceived, notifyUserBookingConfirmation, notifyAdmin } from "@/lib/notify";
import { RideStatus } from "@prisma/client";

export async function POST(request: Request) {
  try {
    console.log("card/confirm: Starting payment confirmation");

    const me = await getCurrentUser();
    if (!me) {
      console.error("card/confirm: User not authenticated");
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.log("card/confirm: User authenticated", { userId: me.id, email: me.email });

    const raw = await request.json().catch(() => ({}));
    console.log("card/confirm: Received payload", raw);

    const parsed = ConfirmCardPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("card/confirm: Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { paymentIntentId } = parsed.data;
    console.log("card/confirm: Payment intent ID", paymentIntentId);

    // Handle mock payments for admin users
    if (paymentIntentId.startsWith('pi_mock_')) {
      console.log("card/confirm: Processing mock payment for admin user");

      // Mock payment - simulate success
      // For admin users, get the actual booking amount from database
      console.log("card/confirm: Finding unpaid booking for user to get amount");

      const booking = await prisma.ride.findFirst({
        where: { userId: me.id, paid: false },
        orderBy: { createdAt: 'desc' }
      });

      if (!booking) {
        console.error("card/confirm: No unpaid booking found for user");
        return NextResponse.json({ error: "No unpaid booking found" }, { status: 400 });
      }

      const amountDkk = booking.price; // Use actual booking price
      console.log("card/confirm: Mock amount from booking", amountDkk, "bookingId:", booking.id);

      // Save payment record
      console.log("card/confirm: Creating payment record with userId:", me.id.toString(), "amountDkk:", amountDkk);
      const payment = await prisma.cardPayment.create({
        data: {
          userId: me.id.toString(),
          amountDkk: amountDkk, // Use actual booking amount
          status: "paid",
        },
      });
      console.log("card/confirm: Mock payment record created", { paymentId: payment.id, userId: me.id.toString() });

      // Update booking status to paid and confirmed
      console.log("card/confirm: Updating booking status", { bookingId: booking.id });

      await prisma.ride.update({
        where: { id: booking.id },
        data: { paid: true, status: 'PAID' as any }
      });

      // Send confirmation emails
      const bookingDetails = {
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        pickupTime: booking.pickupTime,
        passengers: booking.passengers,
        vehicleType: 'Standard',
        price: booking.price,
        id: booking.id
      };

      console.log("card/confirm: Sending confirmation emails");
      await notifyUserBookingConfirmation(me.email, me.firstName, bookingDetails).catch((e) => {
        console.error("card/confirm: Failed to send booking confirmation email", e);
      });
      await notifyUserPaymentReceived(me.email, me.firstName, {
        amount: amountDkk,
        method: 'Mock Card Payment',
        transactionId: paymentIntentId,
        bookingId: booking.id.toString(),
      }).catch((e) => {
        console.error("card/confirm: Failed to send payment confirmation email", e);
      });

      await notifyAdmin(`New Booking Payment - Admin Mode (Mock)`, `
        <p>A new booking has been created in admin mode with mock payment:</p>
        <ul>
          <li><strong>User:</strong> ${me.firstName} ${me.lastName} (${me.email})</li>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Amount:</strong> ${amountDkk} DKK</li>
          <li><strong>Payment Method:</strong> Mock Card Payment</li>
        </ul>
      `).catch((e) => {
        console.error("card/confirm: Failed to send admin notification", e);
      });

      console.log("card/confirm: Mock payment confirmation complete");
      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        amount: amountDkk,
      });
    }

    // Real Stripe payment processing
    console.log("card/confirm: Processing real Stripe payment");

    // Verify payment with Stripe
    console.log("card/confirm: Retrieving payment intent from Stripe");
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);

    console.log("card/confirm: Payment intent status", paymentIntent.status);

    if (paymentIntent.status !== 'succeeded') {
      console.error("card/confirm: Payment not completed", { status: paymentIntent.status });
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    // Extract metadata
    const amountDkk = paymentIntent.amount / 100; // Convert from øre to DKK
    const bookingId = paymentIntent.metadata?.bookingId;
    console.log("card/confirm: Extracted data", { amountDkk, bookingId });

    // Save payment record
    console.log("card/confirm: Creating payment record in database");
    const payment = await prisma.cardPayment.create({
      data: {
        userId: me.id.toString(),
        amountDkk,
        status: "paid",
      },
    });
    console.log("card/confirm: Payment record created", { paymentId: payment.id });

    // Update booking status to paid and confirmed
    if (bookingId && me.email) {
      console.log("card/confirm: Updating booking status", { bookingId });

      const booking = await prisma.ride.findUnique({
        where: { id: parseInt(bookingId) }
      });

      if (booking) {
        console.log("card/confirm: Found booking, updating to paid and confirmed");

        await prisma.ride.update({
          where: { id: booking.id },
          data: { paid: true, status: 'CONFIRMED' }
        });

        // Send confirmation emails
        const bookingDetails = {
          pickupAddress: booking.pickupAddress,
          dropoffAddress: booking.dropoffAddress,
          pickupTime: booking.pickupTime,
          passengers: booking.passengers,
          vehicleType: 'Standard',
          price: booking.price,
          id: booking.id
        };

        console.log("card/confirm: Sending confirmation emails");
        await notifyUserBookingConfirmation(me.email, me.firstName, bookingDetails).catch((e) => {
          console.error("card/confirm: Failed to send booking confirmation email", e);
        });
        await notifyUserPaymentReceived(me.email, me.firstName, {
          amount: amountDkk,
          method: 'Credit/Debit Card',
          transactionId: paymentIntentId,
          bookingId: booking.id.toString(),
        }).catch((e) => {
          console.error("card/confirm: Failed to send payment confirmation email", e);
        });

        await notifyAdmin(`New Booking Payment`, `
          <p>A new booking has been created with successful payment:</p>
          <ul>
            <li><strong>User:</strong> ${me.firstName} ${me.lastName} (${me.email})</li>
            <li><strong>Booking ID:</strong> ${booking.id}</li>
            <li><strong>Amount:</strong> ${amountDkk} DKK</li>
            <li><strong>Payment Method:</strong> Card Payment</li>
            <li><strong>Transaction ID:</strong> ${paymentIntentId}</li>
          </ul>
        `).catch((e) => {
          console.error("card/confirm: Failed to send admin notification", e);
        });
      } else {
        console.warn("card/confirm: Booking not found", { bookingId });
      }
    } else {
      console.warn("card/confirm: No booking ID or user email for booking update");
    }

    console.log("card/confirm: Payment confirmation complete");
    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      amount: amountDkk,
    });
  } catch (e: any) {
    console.error("card/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}