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

    const body = await request.json().catch(() => ({} as any));
    const paymentId = body?.paymentId;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
    }

    // Handle mock payments safely in development only
    if (process.env.NODE_ENV === 'development' && paymentId.startsWith('mock_revolut_')) {
      const amountDkk = 100; // Mock amount

      const payment = await prisma.revolutPayment.create({
        data: {
          userId: me.id.toString(),
          amountDkk,
          status: "paid",
          paymentId,
        },
      });

      if ((me as any).email) {
        const paymentDetails = {
          amount: amountDkk,
          method: 'Revolut',
          transactionId: paymentId,
          bookingId: 'N/A',
        };
        await notifyUserPaymentReceived((me as any).email, (me as any).firstName, paymentDetails).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        amount: amountDkk,
      });
    }

    // In non-development environments, do NOT simulate or accept arbitrary payment IDs.
    // Real Revolut verification must be implemented before enabling this endpoint.
    return NextResponse.json(
      { error: "Revolut verification is not implemented on this server" },
      { status: 501 }
    );
  } catch (e: any) {
    console.error("revolut/confirm failed:", e?.message || e);
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}