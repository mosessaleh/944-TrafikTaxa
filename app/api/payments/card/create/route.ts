import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { createPaymentIntent } from "@/lib/stripe";
import { CardPaymentIntentSchema } from "@/lib/validation";
import { prisma } from "@/lib/db";
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
    if (!me) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const raw = await request.json().catch(() => ({}));

    const parsed = CardPaymentIntentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const { bookingId, invoiceId } = parsed.data;

    // ===== Derive amount server-side from DB (ignore any client-provided amount) =====
    let booking: any = null;
    let invoice: any = null;
    let amountDkk: number;

    if (bookingId) {
      booking = await prisma.ride.findUnique({
        where: { id: bookingId },
        include: { user: true },
      });

      if (!booking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      // Authorization: ensure current user owns the booking or is admin
      if (booking.userId !== me.id && (me.type !== 'user' || (me as any).role !== "ADMIN")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      amountDkk = booking.price;
    } else if (invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { ride: { include: { user: true } } },
      });

      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      // Authorization: ensure current user owns the invoice or is admin
      if (invoice.userId !== me.id && (me.type !== 'user' || (me as any).role !== "ADMIN")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      booking = invoice.ride;
      if (!booking) {
        return NextResponse.json(
          { error: "Invoice has no associated ride" },
          { status: 500 }
        );
      }

      // Prefer explicit invoice paymentAmount if set; otherwise use ride price
      amountDkk =
        typeof invoice.paymentAmount === "number" && invoice.paymentAmount > 0
          ? invoice.paymentAmount
          : booking.price;
    } else {
      // Should be unreachable due to schema refine, but guard anyway
      return NextResponse.json(
        { error: "bookingId or invoiceId must be provided" },
        { status: 400 }
      );
    }

    // Build idempotency key based on user + booking/invoice
    const idempotencyKeyParts = ["user", String(me.id)];
    if (booking?.id) idempotencyKeyParts.push("booking", String(booking.id));
    if (invoice?.id) idempotencyKeyParts.push("invoice", String(invoice.id));
    const idempotencyKey = idempotencyKeyParts.join(":");

    // Create Stripe PaymentIntent using trusted server-side amount and linkage metadata
    const paymentIntent = await createPaymentIntent(amountDkk, "dkk", {
      userId: me.id.toString(),
      bookingId: booking ? booking.id.toString() : "",
      invoiceId: invoice ? invoice.id.toString() : "",
      userEmail: (me as any).email || "",
      expectedAmountDkk: amountDkk.toFixed(2),
    }, idempotencyKey);

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (e: any) {
    console.error("card/create failed:", e?.message || e);
    // Return more specific error for debugging
    return NextResponse.json(
      {
        error: "Internal error",
        details: process.env.NODE_ENV === "development" ? e?.message : undefined,
      },
      { status: 500 }
    );
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
