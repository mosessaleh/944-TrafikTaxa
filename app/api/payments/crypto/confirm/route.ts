import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CryptoPaymentSchema } from "@/lib/validation";
import { notifyAdmin, notifyUserPaymentReceived } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = CryptoPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { symbol, walletId, network, address, amountDkk, amountCoin } = parsed.data;

    // Get booking ID from query params or body (required for crypto payments)
    const url = new URL(request.url);
    const bookingIdParam = url.searchParams.get("booking_id") || raw.bookingId;

    if (!bookingIdParam) {
      return NextResponse.json(
        { error: "Crypto payments are only allowed for scheduled bookings with a valid booking_id" },
        { status: 400 }
      );
    }

    const bookingId = parseInt(bookingIdParam, 10);
    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking_id" }, { status: 400 });
    }

    // Load the related booking to enforce business rules
    const ride = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: {
        scheduled: true,
        pickupTime: true,
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Allow crypto for all bookings, but for scheduled, check time
    if (ride.scheduled && ride.pickupTime <= oneHourFromNow) {
      return NextResponse.json(
        { error: "For scheduled crypto payments, the pickup time must be at least 1 hour from now" },
        { status: 400 }
      );
    }

    // Create new crypto payment record
    const pay = await prisma.cryptoPayment.create({
      data: {
        userId: String(me.id),
        symbol,
        network,
        address,
        amountDkk,
        amountCoin,
        status: "confirmed",
      },
    });

    // Update booking status to PENDING / CRYPTO_PENDING
    console.log(`Updating booking ${bookingId} status to PENDING with pending crypto payment`);
    console.log(`[DEBUG] Updating booking ${bookingId} status to PENDING for crypto payment confirmation`);
    await prisma.ride.update({
      where: { id: bookingId },
      data: {
        status: "PENDING",
        paymentStatus: "CRYPTO_PENDING",
        paymentMethod: "crypto",
        explanation: "Waiting for crypto payment confirmation",
      },
    });
    console.log(`[DEBUG] Booking ${bookingId} status updated to PENDING for crypto`);

    // Notify user (payment confirmed)
    if ((me as any).email) {
      const paymentDetails = {
        amount: amountDkk,
        method: `${symbol.toUpperCase()} (${network})`,
        transactionId: pay.id,
        bookingId: bookingId,
      };
      await notifyUserPaymentReceived((me as any).email, (me as any).firstName, paymentDetails).catch(() => {});
    }

    // Notify admin
    const subjectAdmin = "Crypto payment confirmed";
    const htmlAdmin = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>Crypto Payment Confirmed</h2>
        <p>User ID: ${me.id}${(me as any).email ? ` (${(me as any).email})` : ""}</p>
        <p>Symbol: ${symbol.toUpperCase()} — Network: ${network}</p>
        <p>Address: ${address}</p>
        <p>Amount: ${amountDkk} DKK (~ ${amountCoin} ${symbol.toUpperCase()})</p>
        <p>Payment ID: <code>${pay.id}</code></p>
        <p>Booking ID: <code>${bookingId}</code></p>
      </div>
    `;
    await notifyAdmin(subjectAdmin, htmlAdmin).catch(() => {});

    return NextResponse.json({ ok: true, id: pay.id });
  } catch (e: any) {
    console.error("crypto/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
