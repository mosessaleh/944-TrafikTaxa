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

    console.log("card/confirm: User authenticated", { userId: me.id, email: (me as any).email });

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

      let invoice: any = null;

      // Priority: invoiceId > bookingId (when paying for invoice, use invoice amount)
      if (invoiceId) {
        // Find invoice first when invoiceId is provided
        console.log("card/confirm: Looking for invoice with ID", invoiceId);
        invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: { ride: { include: { user: true, vehicleType: true } } }
        });
        console.log("card/confirm: Invoice lookup result", invoice ? `Found (ID: ${invoice.id})` : 'Not found');
        if (invoice) {
          booking = invoice.ride;
          console.log("card/confirm: Set booking from invoice ride", booking?.id);
        } else {
          console.log("card/confirm: Invoice not found, cannot proceed");
          return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
      } else if (bookingId) {
        // Find booking by ID when no invoiceId provided
        booking = await prisma.ride.findUnique({
          where: { id: bookingId },
          include: { user: true, vehicleType: true }
        });
        console.log("card/confirm: Found booking by bookingId", booking?.id);
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

      // Calculate the total amount including late fees if paying for an invoice
      if (invoice) {
        const baseAmount = invoice.paymentAmount || booking.price;
        const lateFee1 = invoice.lateFee1 || 0;
        const lateFee2 = invoice.lateFee2 || 0;
        amountDkk = baseAmount + lateFee1 + lateFee2;
        // Round to 2 decimal places to avoid precision issues
        amountDkk = Math.round(amountDkk * 100) / 100;
        console.log("card/confirm: Mock amount from invoice (including late fees)", {
          amountDkk,
          baseAmount,
          lateFee1,
          lateFee2,
          bookingId: booking.id,
          invoiceId: invoice.id
        });
      } else {
        // Use the booking price as the intended amount
        amountDkk = booking.price;
        console.log("card/confirm: Mock amount from booking", amountDkk, "bookingId:", booking.id);
      }
 
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
            userEmail: (me as any).email || '',
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
        console.log("card/confirm: Real payment amount from invoice (including late fees)", {
          dbAmountDkk,
          baseAmount,
          lateFee1,
          lateFee2,
          bookingId: booking.id,
          invoiceId: invoiceForAmount.id
        });
      } else {
        console.log("card/confirm: Real payment amount from booking", dbAmountDkk, "bookingId:", booking.id);
      }

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
    if (booking.userId !== me.id && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
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
    console.log(`[DEBUG] Updating booking ${booking.id} status to CONFIRMED and paymentStatus to PAID in card/confirm`);
    const updatedBooking = await prisma.ride.update({
      where: { id: booking.id },
      data: {
        status: 'CONFIRMED',
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
    console.log(`[DEBUG] Booking ${updatedBooking.id} status updated to CONFIRMED in card/confirm`);
    console.log("card/confirm: Booking status updated successfully");

    // === STEP 2.5: Assign vehicles and notify drivers ===
    try {
      console.log(`[DEBUG] card/confirm: Checking booking ${updatedBooking.id} for vehicle assignment: status=${updatedBooking.status}, paymentMethod=${updatedBooking.paymentMethod}, driverId=${updatedBooking.driverId}, car=${updatedBooking.car}`);
      const startLatLon = updatedBooking.startLatLon as any;
      if (startLatLon && typeof startLatLon === 'object' && 'lat' in startLatLon && 'lon' in startLatLon) {
        // Call the vehicle selection API
        const selectionResponse = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vehicle-selection`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pickupLat: startLatLon.lat,
              pickupLon: startLatLon.lon,
              dropoffLat: (updatedBooking.endLatLon as any)?.lat,
              dropoffLon: (updatedBooking.endLatLon as any)?.lon,
              vehicleTypeId: updatedBooking.vehicleTypeId,
              maxVehicles: 3
            })
          }
        );

        if (selectionResponse.ok) {
          const selectionData = await selectionResponse.json();
          if (selectionData.ok && selectionData.vehicles?.length > 0) {
            // Update the booking with the driver queue
            await prisma.ride.update({
              where: { id: updatedBooking.id },
              data: { driverQueue: selectionData.vehicles }
            });
            console.log(`card/confirm: Updated booking ${updatedBooking.id} with driver queue:`, selectionData.vehicles);

            // Get the closest vehicle for notification
            const closestVehicleId = selectionData.vehicles[0];
            const closestVehicle = await prisma.comVehicles.findUnique({
              where: { id: closestVehicleId },
              select: { id: true, regNumber: true }
            });

            // Notify the closest driver by setting currentRideId
            if (closestVehicle) {
              const driver = await prisma.comDriver.findFirst({
                where: {
                  car: closestVehicle.regNumber,
                  isOnline: true,
                  isActive: true,
                  currentRideId: null, // Driver must not have a current ride
                  isBusy: false // Driver must not be busy
                }
              });
              if (driver) {
                  await prisma.comDriver.update({
                    where: { id: driver.id },
                    data: { currentRideId: updatedBooking.id, rideAccepted: 0 }
                  });
                  console.log(`card/confirm: Assigned ride ${updatedBooking.id} to driver ${driver.id} with rideAccepted: 0`);
                } else {
                  console.log(`card/confirm: No available driver found for vehicle ${closestVehicle.regNumber} (driver busy or has current ride)`);
                }
            }
          } else {
            console.warn('card/confirm: Vehicle selection API returned no vehicles');
          }
        } else {
          console.warn('card/confirm: Vehicle selection API call failed:', selectionResponse.status);
        }
      }
    } catch (assignError) {
      console.warn('card/confirm: Failed to assign vehicle to booking:', assignError);
    }


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
          <li><strong>User:</strong> ${(me as any).firstName} ${(me as any).lastName} (${(me as any).email})</li>
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