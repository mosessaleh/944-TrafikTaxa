import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createPaymentIntent } from "@/lib/stripe";
import { CardPaymentIntentSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    console.log("card/create: Starting payment intent creation");

    const me = await getCurrentUser();
    if (!me) {
      console.error("card/create: User not authenticated");
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.log("card/create: User authenticated", { userId: me.id, email: me.email });

    const raw = await request.json().catch(() => ({}));
    console.log("card/create: Received payload", raw);

    const parsed = CardPaymentIntentSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("card/create: Invalid payload", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { amountDkk, bookingId } = parsed.data;
    console.log("card/create: Parsed data", { amountDkk, bookingId });

    console.log("card/create: Creating Stripe PaymentIntent", { amountDkk, currency: 'dkk' });

    // Create Stripe PaymentIntent
    const paymentIntent = await createPaymentIntent(amountDkk, 'dkk', {
      userId: me.id.toString(),
      bookingId: bookingId?.toString() || '',
      userEmail: me.email || '',
    });

    console.log("card/create: PaymentIntent created successfully", {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret?.substring(0, 20) + "..."
    });

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (e: any) {
    console.error("card/create failed:", e?.message || e);
    // Return more specific error for debugging
    return NextResponse.json({
      error: "Internal error",
      details: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500 });
  }
}

// For testing purposes - mock payment without Stripe in development
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Mock payment intent for testing without Stripe keys
  const mockClientSecret = `pi_mock_${Date.now()}_secret_test`;
  const mockPaymentIntentId = `pi_mock_${Date.now()}`;

  return NextResponse.json({
    ok: true,
    clientSecret: mockClientSecret,
    paymentIntentId: mockPaymentIntentId,
    mock: true, // Indicate this is a mock response
  });
}