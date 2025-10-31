import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CryptoPaymentSchema } from "@/lib/validation";
import { notifyAdmin, notifyUserEmail, notifyUserPaymentReceived } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getUserFromCookie();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const raw = await request.json().catch(() => ({}));
    const parsed = CryptoPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { symbol, walletId, network, address, amountDkk, amountCoin } = parsed.data;

    // Get booking ID from query params or body
    const url = new URL(request.url);
    const bookingId = url.searchParams.get('booking_id') || raw.bookingId;

    // Create new crypto payment record
    const pay = await prisma.cryptoPayment.create({
      data: {
        userId: String(me.id),
        symbol,
        network,
        address,
        amountDkk,
        amountCoin,
        status: "confirmed"
      }
    });

    // Update booking status to PAID if bookingId provided
    if (bookingId) {
      console.log(`Updating booking ${bookingId} status to PAID`);
      await (prisma as any).ride.update({
        where: { id: parseInt(bookingId) },
        data: {
          status: 'PAID',
          paid: true,
          paymentMethod: 'crypto'
        }
      });
      console.log(`Booking ${bookingId} updated successfully`);
    }

    // Notify user (payment confirmed)
    if (me.email) {
      const paymentDetails = {
        amount: amountDkk,
        method: `${symbol.toUpperCase()} (${network})`,
        transactionId: pay.id,
        bookingId: bookingId
      };
      await notifyUserPaymentReceived(me.email, me.firstName, paymentDetails).catch(() => {});
    }

    // Notify admin
    const subjectAdmin = "Crypto payment confirmed";
    const htmlAdmin = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>Crypto Payment Confirmed</h2>
        <p>User ID: ${me.id}${me.email ? ` (${me.email})` : ""}</p>
        <p>Symbol: ${symbol.toUpperCase()} — Network: ${network}</p>
        <p>Address: ${address}</p>
        <p>Amount: ${amountDkk} DKK (~ ${amountCoin} ${symbol.toUpperCase()})</p>
        <p>Payment ID: <code>${pay.id}</code></p>
        ${bookingId ? `<p>Booking ID: <code>${bookingId}</code></p>` : ''}
      </div>
    `;
    await notifyAdmin(subjectAdmin, htmlAdmin).catch(() => {});

    return NextResponse.json({ ok: true, id: pay.id });
  } catch (e: any) {
    console.error("crypto/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
