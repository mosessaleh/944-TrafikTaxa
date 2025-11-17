import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyUserPaymentReceived } from "@/lib/notify";
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
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { token } = await request.json().catch(() => ({} as any));

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Handle mock payments safely in development only
    if (process.env.NODE_ENV === 'development' && typeof token === 'string' && token.startsWith('mock_paypal_token_')) {
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
    }

    // In non-development environments, do NOT simulate or accept arbitrary tokens.
    // Real PayPal verification must be implemented before enabling this endpoint.
    return NextResponse.json(
      { error: "PayPal verification is not implemented on this server" },
      { status: 501 }
    );
  } catch (e: any) {
    console.error("paypal/confirm failed:", e?.message || e);
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}