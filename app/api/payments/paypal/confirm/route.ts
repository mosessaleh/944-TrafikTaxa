import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notifyUserPaymentReceived } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Handle mock payments in development
    if (process.env.NODE_ENV === 'development' && token.startsWith('mock_paypal_token_')) {
      // Mock payment - simulate success
      const amountDkk = 100; // Mock amount

      // Save payment record
      const payment = await prisma.payPalPayment.create({
        data: {
          userId: me.id.toString(),
          amountDkk,
          status: "paid",
          paypalOrderId: token,
        },
      });

      // TODO: Create the actual booking here after successful payment
      // For now, just send confirmation email
      if (me.email) {
        const paymentDetails = {
          amount: amountDkk,
          method: 'PayPal',
          transactionId: token,
          bookingId: 'N/A',
        };
        await notifyUserPaymentReceived(me.email, me.firstName, paymentDetails).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        amount: amountDkk,
      });
    }

    // TODO: Implement real PayPal verification
    // For now, return mock success
    const amountDkk = 100; // Mock amount

    const payment = await prisma.payPalPayment.create({
      data: {
        userId: me.id.toString(),
        amountDkk,
        status: "paid",
        paypalOrderId: token,
      },
    });

    if (me.email) {
      const paymentDetails = {
        amount: amountDkk,
        method: 'PayPal',
        transactionId: token,
        bookingId: 'N/A',
      };
      await notifyUserPaymentReceived(me.email, me.firstName, paymentDetails).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      amount: amountDkk,
    });
  } catch (e: any) {
    console.error("paypal/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}