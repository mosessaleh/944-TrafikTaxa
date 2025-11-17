import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PayPalPaymentIntentSchema } from "@/lib/validation";
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

    const raw = await request.json().catch(() => ({}));
    const parsed = PayPalPaymentIntentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { amountDkk } = parsed.data;
    if (!amountDkk || amountDkk <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // In development, simulate PayPal payment
    if (process.env.NODE_ENV === 'development') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      if (!appUrl) {
        return NextResponse.json(
          { error: "App URL not configured for mock PayPal flow" },
          { status: 500 }
        );
      }

      const mockApprovalUrl = `${appUrl}/pay/paypal/success?token=mock_paypal_token_${Date.now()}`;

      return NextResponse.json({
        ok: true,
        approvalUrl: mockApprovalUrl,
        paymentId: `mock_paypal_${Date.now()}`,
      });
    }

    // In non-development environments, do NOT create fake PayPal flows.
    // Real PayPal integration must be implemented before enabling this.
    return NextResponse.json(
      { error: "PayPal integration is not implemented on this server" },
      { status: 501 }
    );
  } catch (e: any) {
    console.error("paypal/create failed:", e?.message || e);
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}