import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { RevolutPaymentIntentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const raw = await request.json().catch(() => ({}));
    const parsed = RevolutPaymentIntentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { amountDkk } = parsed.data;

    // In development, simulate Revolut payment
    if (process.env.NODE_ENV === 'development') {
      // Create mock Revolut payment URL
      const mockPaymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/revolut/success?payment_id=mock_revolut_${Date.now()}`;

      return NextResponse.json({
        ok: true,
        paymentUrl: mockPaymentUrl,
        paymentId: `mock_revolut_${Date.now()}`,
      });
    }

    // TODO: Implement real Revolut integration
    // For now, return mock response
    return NextResponse.json({
      ok: true,
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/revolut/success?payment_id=revolut_${Date.now()}`,
      paymentId: `revolut_${Date.now()}`,
    });
  } catch (e: any) {
    console.error("revolut/create failed:", e?.message || e);
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}