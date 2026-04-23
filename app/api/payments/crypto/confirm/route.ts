import { NextRequest, NextResponse } from "next/server";
import { getAuthSecret, getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CryptoPaymentSchema } from "@/lib/validation";
import { notifyAdmin, notifyUserPaymentReceived } from "@/lib/notify";
import { verify } from "jsonwebtoken";

const JWT_SECRET = getAuthSecret();
const CRYPTO_PROCESSING_FEE_DKK = 25;
const MIN_CRYPTO_LEAD_MINUTES = 60;

async function getUserFromBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = verify(token, JWT_SECRET) as { id?: number; type?: string };
    if (decoded?.type && decoded.type !== "user") {
      return null;
    }

    const userId = Number(decoded?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    return { id: userId };
  } catch {
    return null;
  }
}

function roundDkk(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const bearerUser = await getUserFromBearerToken(request);
    const me = bearerUser || await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const raw = await request.json().catch(() => ({}));
    const parsed = CryptoPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { symbol, walletId, network, address, amountDkk, amountCoin } = parsed.data;
    const url = new URL(request.url);
    const bookingIdParam = url.searchParams.get("booking_id") || raw.bookingId;

    if (!bookingIdParam) {
      return NextResponse.json(
        { error: "Crypto payments require a valid booking_id" },
        { status: 400 }
      );
    }

    const bookingId = parseInt(bookingIdParam, 10);
    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking_id" }, { status: 400 });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        price: true,
        scheduled: true,
        pickupTime: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
      },
    });

    if (!ride) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (Number(ride.userId) !== Number(me.id)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!ride.scheduled) {
      return NextResponse.json(
        { error: "Crypto payments are only allowed for scheduled bookings" },
        { status: 400 }
      );
    }

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + MIN_CRYPTO_LEAD_MINUTES * 60 * 1000);
    if (ride.pickupTime <= oneHourFromNow) {
      return NextResponse.json(
        { error: "For scheduled crypto payments, the pickup time must be at least 1 hour from now" },
        { status: 400 }
      );
    }

    const immutableStatuses = new Set([
      "CANCELED",
      "COMPLETED",
      "REFUNDED",
      "DELIVERED",
      "PICKED_UP",
      "ONGOING",
      "DISPATCHED",
      "IN_PROGRESS",
    ]);
    const rideStatus = String(ride.status || "").toUpperCase();
    if (immutableStatuses.has(rideStatus)) {
      return NextResponse.json(
        { error: "Cannot confirm crypto payment for this booking status" },
        { status: 400 }
      );
    }

    if (ride.paymentMethod && ride.paymentMethod !== "crypto") {
      return NextResponse.json(
        { error: "This booking is not configured for crypto payment" },
        { status: 409 }
      );
    }

    const wallet = await prisma.cryptoWallet.findFirst({
      where: {
        id: walletId,
        symbol,
        isActive: true,
      },
      select: {
        id: true,
        symbol: true,
        network: true,
        address: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: "Selected crypto wallet is not available" },
        { status: 400 }
      );
    }

    if (wallet.network !== network || wallet.address !== address) {
      return NextResponse.json(
        { error: "Selected wallet details do not match the active wallet configuration" },
        { status: 400 }
      );
    }

    const expectedAmountDkk = roundDkk(Number(ride.price || 0) + CRYPTO_PROCESSING_FEE_DKK);
    const submittedAmountDkk = roundDkk(Number(amountDkk || 0));
    if (submittedAmountDkk !== expectedAmountDkk) {
      return NextResponse.json(
        {
          error: `Crypto payment amount must equal the booking price plus ${CRYPTO_PROCESSING_FEE_DKK} DKK processing fee`,
          expectedAmountDkk,
        },
        { status: 400 }
      );
    }

    const pay = await prisma.cryptoPayment.create({
      data: {
        userId: String(me.id),
        symbol: wallet.symbol,
        network: wallet.network,
        address: wallet.address,
        amountDkk: submittedAmountDkk,
        amountCoin,
        status: "confirmed",
      },
    });

    await prisma.ride.update({
      where: { id: bookingId },
      data: {
        status: "PENDING",
        paymentStatus: "CRYPTO_PENDING",
        paymentMethod: "crypto",
        explanation: `Waiting for crypto payment confirmation (+${CRYPTO_PROCESSING_FEE_DKK} DKK fee)`,
      },
    });

    if ((me as any).email) {
      const paymentDetails = {
        amount: submittedAmountDkk,
        method: `${wallet.symbol.toUpperCase()} (${wallet.network})`,
        transactionId: pay.id,
        bookingId,
      };
      await notifyUserPaymentReceived((me as any).email, (me as any).firstName, paymentDetails).catch(() => {});
    }

    const subjectAdmin = "Crypto payment confirmed";
    const htmlAdmin = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>Crypto Payment Confirmed</h2>
        <p>User ID: ${me.id}${(me as any).email ? ` (${(me as any).email})` : ""}</p>
        <p>Symbol: ${wallet.symbol.toUpperCase()} - Network: ${wallet.network}</p>
        <p>Address: ${wallet.address}</p>
        <p>Amount: ${submittedAmountDkk} DKK (~ ${amountCoin} ${wallet.symbol.toUpperCase()})</p>
        <p>Includes processing fee: ${CRYPTO_PROCESSING_FEE_DKK} DKK</p>
        <p>Payment ID: <code>${pay.id}</code></p>
        <p>Booking ID: <code>${bookingId}</code></p>
      </div>
    `;
    await notifyAdmin(subjectAdmin, htmlAdmin).catch(() => {});

    return NextResponse.json({
      ok: true,
      id: pay.id,
      feeDkk: CRYPTO_PROCESSING_FEE_DKK,
      expectedAmountDkk,
    });
  } catch (e: any) {
    console.error("crypto/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
