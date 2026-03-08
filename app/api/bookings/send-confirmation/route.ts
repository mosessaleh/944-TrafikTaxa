import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { notifyUserBookingConfirmation, notifyUserPaymentReceived, notifyAdmin } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    if ((me as any).role !== 'ADMIN') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    const { booking, bookingDetails, paymentAmount, isMockPayment, userEmail, userFirstName } = data;

    const safeBooking = booking && typeof booking === 'object' ? booking : {};
    const safeBookingDetails = bookingDetails && typeof bookingDetails === 'object' ? bookingDetails : {};

    if (!safeBooking.id || !userEmail || !userFirstName) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const safeAmount = Number(paymentAmount);
    if (!Number.isFinite(safeAmount) || safeAmount < 0) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    // Send booking confirmation email to user
    await notifyUserBookingConfirmation(userEmail, userFirstName, safeBookingDetails).catch(() => {});

    // Send payment confirmation email
    const paymentDetails = {
      amount: safeAmount,
      method: isMockPayment ? 'Mock Card Payment' : 'Credit/Debit Card',
      transactionId: 'Payment confirmed',
      bookingId: String(safeBooking.id),
    };
    await notifyUserPaymentReceived(userEmail, userFirstName, paymentDetails).catch(() => {});

    // Send admin notification
    const adminSubject = `New Booking Created${isMockPayment ? ' (Admin Mode)' : ''}`;
    const adminBody = `
      <p>A new booking has been created${isMockPayment ? ' in admin mode' : ''}:</p>
      <ul>
        <li><strong>User:</strong> ${userFirstName} ${me.lastName} (${userEmail})</li>
        <li><strong>Booking ID:</strong> ${safeBooking.id}</li>
        <li><strong>Amount:</strong> ${safeAmount} DKK</li>
        <li><strong>Payment Method:</strong> ${isMockPayment ? 'Mock Card Payment' : 'Card Payment'}</li>
        <li><strong>Pickup:</strong> ${safeBooking.pickupAddress || '-'}</li>
        <li><strong>Dropoff:</strong> ${safeBooking.dropoffAddress || '-'}</li>
        <li><strong>Time:</strong> ${safeBooking.pickupTime || '-'}</li>
      </ul>
    `;
    await notifyAdmin(adminSubject, adminBody).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-confirmation failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
