import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PayPalPaymentIntentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const raw = await request.json().catch(() => ({}));
    const parsed = PayPalPaymentIntentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { amountDkk } = parsed.data;

    // In development, simulate PayPal payment
    if (process.env.NODE_ENV === 'development') {
      // Create mock PayPal approval URL
      const mockApprovalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/paypal/success?token=mock_paypal_token_${Date.now()}`;

      return NextResponse.json({
        ok: true,
        approvalUrl: mockApprovalUrl,
        paymentId: `mock_paypal_${Date.now()}`,
      });
    }

    // TODO: Implement real PayPal integration
    // For now, return mock response
    return NextResponse.json({
      ok: true,
      approvalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/paypal/success?token=paypal_token_${Date.now()}`,
      paymentId: `paypal_${Date.now()}`,
    });
  } catch (e: any) {
    console.error("paypal/create failed:", e?.message || e);
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}