import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { retrievePaymentIntent, stripe as getStripe } from "@/lib/stripe";
import { ConfirmCardPaymentSchema } from "@/lib/validation";
import { notifyAdmin } from "@/lib/notify";
import { notifyBookingConfirmedUnified, notifyPaymentReceivedUnified } from "@/lib/notification-service";
import { validateRequestOrigin } from "@/lib/security-headers";

export async function POST(request: Request) {
  try {
    const originCheck = validateRequestOrigin(request);
    if (!originCheck.ok) {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 }
      );
    }

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
    let booking: any = null;
    let invoiceForAmount: any = null;
 
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

      // Prefer booking/invoice identifiers from Stripe metadata (server-controlled)
      const metadata = (paymentIntent as any).metadata || {};
      const metaBookingId = metadata.bookingId ? Number(metadata.bookingId) : undefined;
      const metaInvoiceId = metadata.invoiceId ? Number(metadata.invoiceId) : undefined;
      const metaExpectedAmountDkk = metadata.expectedAmountDkk
        ? Number(metadata.expectedAmountDkk)
        : undefined;

      const effectiveBookingId = Number.isFinite(metaBookingId) && metaBookingId! > 0
        ? metaBookingId
        : bookingId;

      const effectiveInvoiceId = Number.isFinite(metaInvoiceId) && metaInvoiceId! > 0
        ? metaInvoiceId
        : invoiceId;

      console.log("card/confirm: Effective linkage from metadata/body", {
        bookingIdBody: bookingId,
        invoiceIdBody: invoiceId,
        bookingIdMeta: metaBookingId,
        invoiceIdMeta: metaInvoiceId,
        effectiveBookingId,
        effectiveInvoiceId,
      });

      if (!effectiveBookingId && !effectiveInvoiceId) {
        console.error("card/confirm: No booking/invoice linkage found in metadata or body");
        return NextResponse.json(
          { error: "Unable to link payment to booking/invoice" },
          { status: 400 }
        );
      }

      if (effectiveBookingId) {
        booking = await prisma.ride.findUnique({
          where: { id: effectiveBookingId },
          include: { user: true, vehicleType: true }
        });
        if (!booking) {
          console.error("card/confirm: Booking not found for effectiveBookingId", {
            effectiveBookingId,
          });
          return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
      } else if (effectiveInvoiceId) {
        invoiceForAmount = await prisma.invoice.findUnique({
          where: { id: effectiveInvoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        if (!invoiceForAmount) {
          console.error("card/confirm: Invoice not found for effectiveInvoiceId", {
            effectiveInvoiceId,
          });
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
        booking = invoiceForAmount.ride;
        if (!booking) {
          console.error("card/confirm: Invoice has no associated ride", {
            effectiveInvoiceId,
          });
          return NextResponse.json(
            { error: "Invoice has no associated ride" },
            { status: 500 }
          );
        }
      }

      // Derive authoritative amount from DB: prefer invoice.paymentAmount, else ride.price
      const dbAmountDkk =
        invoiceForAmount &&
        typeof invoiceForAmount.paymentAmount === "number" &&
        invoiceForAmount.paymentAmount > 0
          ? invoiceForAmount.paymentAmount
          : booking.price;

      const amountFromGatewayDkk = paymentIntent.amount / 100; // Convert from øre to DKK

      console.log("card/confirm: Amounts for verification", {
        dbAmountDkk,
        amountFromGatewayDkk,
        paymentIntentAmount: paymentIntent.amount,
        metaExpectedAmountDkk,
      });

      // Assert server-side: the amount charged by Stripe must equal the DB amount
      if (Math.round(dbAmountDkk * 100) !== paymentIntent.amount) {
        console.error("card/confirm: Amount mismatch between DB and Stripe", {
          dbAmountDkk,
          dbAmountOre: Math.round(dbAmountDkk * 100),
          stripeAmountOre: paymentIntent.amount,
        });
        return NextResponse.json(
          { error: "Payment amount mismatch. Please contact support." },
          { status: 400 }
        );
      }

      // Optional secondary check against metadata.expectedAmountDkk (defense-in-depth)
      if (
        typeof metaExpectedAmountDkk === "number" &&
        metaExpectedAmountDkk > 0 &&
        Math.round(metaExpectedAmountDkk * 100) !== paymentIntent.amount
      ) {
        console.error("card/confirm: Metadata expectedAmountDkk mismatch", {
          metaExpectedAmountDkk,
          metaExpectedAmountOre: Math.round(metaExpectedAmountDkk * 100),
          stripeAmountOre: paymentIntent.amount,
        });
        return NextResponse.json(
          { error: "Payment amount mismatch (metadata). Please contact support." },
          { status: 400 }
        );
      }

      amountDkk = amountFromGatewayDkk;
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

    // === STEP 4: Send notifications (email + in-app + realtime) ===
    const bookingDetails = {
      pickupAddress: booking.pickupAddress,
      dropoffAddress: booking.dropoffAddress,
      pickupTime: booking.pickupTime,
      passengers: booking.passengers,
      vehicleType: booking.vehicleType?.title || 'Standard',
      price: booking.price,
      id: booking.id
    };

    console.log("card/confirm: Sending confirmation notifications");
    try {
      await notifyBookingConfirmedUnified(
        { id: booking.userId, email: booking.user.email, firstName: booking.user.firstName },
        bookingDetails
      );
      console.log("card/confirm: Booking confirmation notification dispatched");
    } catch (e) {
      console.error("card/confirm: Failed to send booking confirmation notification", e);
    }

    const paymentDetailsForNotify = {
      amount: amountDkk,
      method: paymentIntentId.startsWith('pi_mock_') ? 'Mock Card Payment' : 'Credit/Debit Card',
      transactionId: paymentIntentId,
      bookingId: booking.id.toString(),
      invoiceId: invoice.id.toString(),
    };

    try {
      await notifyPaymentReceivedUnified(
        { id: booking.userId, email: booking.user.email, firstName: booking.user.firstName },
        paymentDetailsForNotify
      );
      console.log("card/confirm: Payment confirmation notification dispatched");
    } catch (e) {
      console.error("card/confirm: Failed to send payment confirmation notification", e);
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