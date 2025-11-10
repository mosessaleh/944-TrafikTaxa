import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { notifyUserBookingConfirmation, notifyUserPaymentReceived, notifyAdmin } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const data = await request.json();
    const { booking, bookingDetails, paymentAmount, isMockPayment, userEmail, userFirstName } = data;

    // Send booking confirmation email to user
    await notifyUserBookingConfirmation(userEmail, userFirstName, bookingDetails).catch(() => {});

    // Send payment confirmation email
    const paymentDetails = {
      amount: paymentAmount,
      method: isMockPayment ? 'Mock Card Payment' : 'Credit/Debit Card',
      transactionId: 'Payment confirmed',
      bookingId: booking.id.toString(),
    };
    await notifyUserPaymentReceived(userEmail, userFirstName, paymentDetails).catch(() => {});

    // Send admin notification
    const adminSubject = `New Booking Created${isMockPayment ? ' (Admin Mode)' : ''}`;
    const adminBody = `
      <p>A new booking has been created${isMockPayment ? ' in admin mode' : ''}:</p>
      <ul>
        <li><strong>User:</strong> ${userFirstName} ${me.lastName} (${userEmail})</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
        <li><strong>Amount:</strong> ${paymentAmount} DKK</li>
        <li><strong>Payment Method:</strong> ${isMockPayment ? 'Mock Card Payment' : 'Card Payment'}</li>
        <li><strong>Pickup:</strong> ${booking.pickupAddress}</li>
        <li><strong>Dropoff:</strong> ${booking.dropoffAddress}</li>
        <li><strong>Time:</strong> ${booking.pickupTime}</li>
      </ul>
    `;
    await notifyAdmin(adminSubject, adminBody).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("send-confirmation failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}