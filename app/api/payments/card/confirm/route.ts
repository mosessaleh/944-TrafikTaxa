import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retrievePaymentIntent, stripe as getStripe } from "@/lib/stripe";
import { ConfirmCardPaymentSchema } from "@/lib/validation";
import { notifyUserPaymentReceived, notifyUserBookingConfirmation, notifyAdmin } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    console.log("card/confirm: Starting payment confirmation");

    const me = await getUserFromCookie();
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

    const { paymentIntentId, bookingId, invoiceId } = parsed.data;
    console.log("card/confirm: Parsed data", { paymentIntentId, bookingId, invoiceId });

    let amountDkk = 0;
    let booking = null;
 
    // Handle mock payments for admin users (development flow)
    if (paymentIntentId.startsWith('pi_mock_')) {
      console.log("card/confirm: Processing mock payment for admin user (Stripe test)");
 
      if (bookingId) {
        // Find booking by ID
        booking = await prisma.ride.findUnique({
          where: { id: bookingId },
          include: { user: true, vehicleType: true }
        });
      } else if (invoiceId) {
        // Find booking from invoice
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        if (invoice) {
          booking = invoice.ride;
        }
      } else {
        // Fallback: find first unpaid booking
        booking = await prisma.ride.findFirst({
          where: { userId: me.id, paymentStatus: 'UNPAID' },
          orderBy: { createdAt: 'desc' },
          include: { user: true, vehicleType: true }
        });
      }
 
      if (!booking) {
        console.error("card/confirm: No unpaid booking found for user");
        return NextResponse.json({ error: "No unpaid booking found" }, { status: 400 });
      }
 
      // Use the booking price as the intended amount
      amountDkk = booking.price;
      console.log("card/confirm: Mock amount from booking", amountDkk, "bookingId:", booking.id);
 
      // Create a real Stripe test PaymentIntent so it appears in the Stripe Dashboard (test mode)
      try {
        const stripeClient = getStripe();
        console.log("card/confirm: Creating Stripe test PaymentIntent for mock payment");
 
        const stripeIntent = await stripeClient.paymentIntents.create({
          amount: Math.round(amountDkk * 100), // øre for DKK
          currency: 'dkk',
          // Limit to card payments only so Stripe does not require return_url for redirect methods
          payment_method_types: ['card'],
          payment_method: 'pm_card_visa', // Stripe test card
          confirm: true,
          metadata: {
            userId: me.id.toString(),
            bookingId: booking.id.toString(),
            userEmail: me.email || '',
            mock: 'true'
          }
        });
 
        console.log("card/confirm: Stripe test PaymentIntent created", {
          id: stripeIntent.id,
          status: stripeIntent.status,
          amount: stripeIntent.amount
        });
 
        if (stripeIntent.status !== 'succeeded') {
          console.error("card/confirm: Stripe test payment not completed", { status: stripeIntent.status });
          return NextResponse.json({ error: "Stripe test payment not completed" }, { status: 400 });
        }
 
        // Ensure amount is synchronized with Stripe (in case of rounding)
        amountDkk = stripeIntent.amount / 100;
      } catch (stripeError: any) {
        console.error("card/confirm: Stripe test payment failed", stripeError);
        return NextResponse.json(
          { error: "Stripe test payment failed", details: stripeError?.message },
          { status: 500 }
        );
      }
 
    } else {
      // Real Stripe payment processing
      console.log("card/confirm: Processing real Stripe payment");
 
      const paymentIntent = await retrievePaymentIntent(paymentIntentId);
      console.log("card/confirm: Payment intent status", paymentIntent.status);
 
      if (paymentIntent.status !== 'succeeded') {
        console.error("card/confirm: Payment not completed", { status: paymentIntent.status });
        return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
      }
 
      amountDkk = paymentIntent.amount / 100; // Convert from øre to DKK
 
      if (bookingId) {
        booking = await prisma.ride.findUnique({
          where: { id: bookingId },
          include: { user: true, vehicleType: true }
        });
      } else if (invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        if (invoice) {
          booking = invoice.ride;
        }
      }
    }

    if (!booking) {
      console.error("card/confirm: No booking found for payment confirmation");
      return NextResponse.json({ error: "Booking not found" }, { status: 400 });
    }

    // Check authorization
    if (booking.userId !== me.id && me.role !== 'ADMIN') {
      console.error("card/confirm: Access denied for booking", { bookingId: booking.id, userId: me.id });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // === STEP 1: Create payment record in database ===
    console.log("card/confirm: Creating payment record in database");
    const payment = await prisma.cardPayment.create({
      data: {
        userId: me.id.toString(),
        amountDkk: amountDkk,
        status: "paid",
      },
    });
    console.log("card/confirm: Payment record created successfully", { 
      paymentId: payment.id, 
      amountDkk: amountDkk,
      userId: me.id,
      bookingId: booking.id
    });

    // === STEP 2: Update booking status ===
    console.log("card/confirm: Updating booking status to CONFIRMED and PAID");
    await prisma.ride.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'card'
      }
    });
    console.log("card/confirm: Booking status updated successfully");

    // === STEP 3: Create/Update invoice as receipt ===
    console.log("card/confirm: Checking/creating invoice as receipt");
    let invoice = await prisma.invoice.findFirst({
      where: { rideId: booking.id }
    });
    
    if (!invoice) {
      // إنشاء فاتورة كإيصال لأن طريقة الدفع ليست "invoice"
      console.log("card/confirm: Creating receipt invoice");
      const invoiceNumber = `REC${booking.id.toString().padStart(6, '0')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 8); // 8 أيام
      
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: invoiceNumber,
          userId: booking.userId,
          rideId: booking.id,
          dueDate: dueDate,
          paymentStatus: 'PAID', // مدفوعة فوراً
          status: 1
        }
      });
      console.log("card/confirm: Receipt invoice created successfully", { invoiceId: invoice.id });
    } else if (invoice.paymentStatus !== 'PAID') {
      // تحديث الفاتورة الموجودة إلى مدفوعة فقط إذا لم تكن مدفوعة
      console.log("card/confirm: Updating existing invoice status to PAID");
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentStatus: 'PAID' }
      });
      console.log("card/confirm: Existing invoice status updated successfully");
    }

    // === STEP 4: Send confirmation emails (optional but recommended) ===
    const bookingDetails = {
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupTime: booking.pickupTime,
      passengers: booking.passengers,
      vehicleType: booking.vehicleType?.title || 'Standard',
      price: booking.price,
      id: booking.id
    };

    console.log("card/confirm: Sending confirmation emails");
    try {
      await notifyUserBookingConfirmation(me.email, me.firstName, bookingDetails);
      console.log("card/confirm: Booking confirmation email sent");
    } catch (e) {
      console.error("card/confirm: Failed to send booking confirmation email", e);
    }

    try {
      await notifyUserPaymentReceived(me.email, me.firstName, {
        amount: amountDkk,
        method: paymentIntentId.startsWith('pi_mock_') ? 'Mock Card Payment' : 'Credit/Debit Card',
        transactionId: paymentIntentId,
        bookingId: booking.id.toString(),
        invoiceId: invoice.id.toString(),
      });
      console.log("card/confirm: Payment confirmation email sent");
    } catch (e) {
      console.error("card/confirm: Failed to send payment confirmation email", e);
    }

    try {
      await notifyAdmin(`New Booking Payment`, `
        <p>A new booking has been created with successful payment:</p>
        <ul>
          <li><strong>User:</strong> ${me.firstName} ${me.lastName} (${me.email})</li>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Amount:</strong> ${amountDkk} DKK</li>
          <li><strong>Payment Method:</strong> ${paymentIntentId.startsWith('pi_mock_') ? 'Mock Card Payment' : 'Card Payment'}</li>
          <li><strong>Transaction ID:</strong> ${paymentIntentId}</li>
        </ul>
      `);
      console.log("card/confirm: Admin notification sent");
    } catch (e) {
      console.error("card/confirm: Failed to send admin notification", e);
    }

    console.log("card/confirm: Payment confirmation completed successfully");
    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount: amountDkk,
      bookingId: booking.id,
    });
  } catch (e: any) {
    console.error("card/confirm failed:", e?.message || e);
    return NextResponse.json({ 
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}