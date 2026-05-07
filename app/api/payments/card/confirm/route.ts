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

    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const raw = await request.json().catch(() => ({}));

    const parsed = ConfirmCardPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { paymentIntentId, bookingId, invoiceId } = parsed.data;

    let amountDkk = 0;
    let booking: any = null;
    let invoiceForAmount: any = null;

    // Handle mock payments for admin users (development flow)
    if (paymentIntentId.startsWith('pi_mock_')) {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
      }

      if ((me as any).role !== 'ADMIN') {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      let invoice: any = null;

      // Priority: invoiceId > bookingId (when paying for invoice, use invoice amount)
      if (invoiceId) {
        // Find invoice first when invoiceId is provided
        invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        if (invoice) {
          booking = invoice.ride;
        } else {
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
      } else if (bookingId) {
        // Find booking by ID when no invoiceId provided
        booking = await prisma.ride.findUnique({
          where: { id: bookingId },
          include: { user: true, vehicleType: true }
        });
      } else {
        // Fallback: find first unpaid booking
        booking = await prisma.ride.findFirst({
          where: { userId: me.id, paymentStatus: 'UNPAID' },
          orderBy: { createdAt: 'desc' },
          include: { user: true, vehicleType: true }
        });
      }

      if (!booking) {
        return NextResponse.json({ error: "No unpaid booking found" }, { status: 400 });
      }

      // Calculate the total amount including late fees if paying for an invoice
      if (invoice) {
        const baseAmount = invoice.paymentAmount || booking.price;
        const lateFee1 = invoice.lateFee1 || 0;
        const lateFee2 = invoice.lateFee2 || 0;
        amountDkk = baseAmount + lateFee1 + lateFee2;
        // Round to 2 decimal places to avoid precision issues
        amountDkk = Math.round(amountDkk * 100) / 100;
      } else {
        // Use the booking price as the intended amount
        amountDkk = booking.price;
      }
 
      // Create a real Stripe test PaymentIntent so it appears in the Stripe Dashboard (test mode)
      try {
        const stripeClient = getStripe();
 
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
            userEmail: (me as any).email || '',
            mock: 'true'
          }
        });
 
        if (stripeIntent.status !== 'succeeded') {
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
      const paymentIntent = await retrievePaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
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

      if (!effectiveBookingId && !effectiveInvoiceId) {
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
          return NextResponse.json({ error: "Booking not found" }, { status: 404 });
        }
      } else if (effectiveInvoiceId) {
        invoiceForAmount = await prisma.invoice.findUnique({
          where: { id: effectiveInvoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        if (!invoiceForAmount) {
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

      // Derive authoritative amount from DB: calculate total including late fees for invoices
      let dbAmountDkk = booking.price; // Default to booking price

      if (invoiceForAmount) {
        // For invoice payments, calculate total including late fees
        const baseAmount = invoiceForAmount.paymentAmount || booking.price;
        const lateFee1 = invoiceForAmount.lateFee1 || 0;
        const lateFee2 = invoiceForAmount.lateFee2 || 0;
        dbAmountDkk = baseAmount + lateFee1 + lateFee2;
        // Round to 2 decimal places to avoid precision issues
        dbAmountDkk = Math.round(dbAmountDkk * 100) / 100;
      }

      const amountFromGatewayDkk = paymentIntent.amount / 100; // Convert from øre to DKK

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
    if (booking.userId !== me.id && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
      console.error("card/confirm: Access denied for booking", { bookingId: booking.id, userId: me.id });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // === STEP 1: Create payment record in database ===
    const payment = await prisma.cardPayment.create({
      data: {
        userId: me.id.toString(),
        amountDkk: amountDkk,
        status: "paid",
      },
    });
    // === STEP 2: Update booking status ===
    const currentStatus = String(booking.status || '').toUpperCase();
    const activeBookingStatuses = ['PENDING', 'PROGRESSING', 'CONFIRMED', 'DISPATCHED', 'ONGOING', 'PICKED_UP', 'IN_PROGRESS'];
    const targetStatus = activeBookingStatuses.includes(currentStatus) ? 'CONFIRMED' : booking.status;

    const updatedBooking = await prisma.ride.update({
      where: { id: booking.id },
      data: {
        status: targetStatus,
        paymentStatus: 'PAID',
        paymentMethod: 'card'
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        vehicleType: {
          select: {
            id: true,
            title: true,
          }
        }
      }
    });
    // === STEP 2.5: Trigger dispatcher to send ride offers ===
    try {
      const dispatcher = (global as any).checkForNewRides;
      if (typeof dispatcher === 'function') {
        dispatcher();
      }
    } catch (dispatchError) {
      console.warn('card/confirm: Failed to trigger ride dispatcher:', dispatchError);
    }


    // === STEP 3: Create/Update invoice as receipt ===
    let invoice = await prisma.invoice.findFirst({
      where: { rideId: booking.id }
    });
    
    if (!invoice) {
      // إنشاء فاتورة كإيصال لأن طريقة الدفع ليست "invoice"
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
    } else if (invoice.paymentStatus !== 'PAID') {
      // تحديث الفاتورة الموجودة إلى مدفوعة فقط إذا لم تكن مدفوعة
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { paymentStatus: 'PAID' }
      });
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

    try {
      await notifyBookingConfirmedUnified(
        { id: booking.userId, email: booking.user.email, firstName: booking.user.firstName },
        bookingDetails
      );
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
    } catch (e) {
      console.error("card/confirm: Failed to send payment confirmation notification", e);
    }

    try {
      await notifyAdmin(`New Booking Payment`, `
        <p>A new booking has been created with successful payment:</p>
        <ul>
          <li><strong>User:</strong> ${(me as any).firstName} ${(me as any).lastName} (${(me as any).email})</li>
          <li><strong>Booking ID:</strong> ${booking.id}</li>
          <li><strong>Amount:</strong> ${amountDkk} DKK</li>
          <li><strong>Payment Method:</strong> ${paymentIntentId.startsWith('pi_mock_') ? 'Mock Card Payment' : 'Card Payment'}</li>
          <li><strong>Transaction ID:</strong> ${paymentIntentId}</li>
        </ul>
      `);
    } catch (e) {
      console.error("card/confirm: Failed to send admin notification", e);
    }

    console.log("card/confirm: Payment confirmation completed", {
      bookingId: booking.id,
      paymentId: payment.id,
      invoiceId: invoice.id,
    });
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
