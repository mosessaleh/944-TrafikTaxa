import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ConfirmCryptoPaymentSchema } from "@/lib/validation";
import { notifyAdmin, notifyUserEmail, notifyUserPaymentReceived } from "@/lib/notify";

export async function POST(request: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const raw = await request.json().catch(() => ({}));
    const parsed = ConfirmCryptoPaymentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { bookingId, transactionHash } = parsed.data;

    // Prisma expects string userId
    const userId = String(me.id);

    // Find the crypto payment by transaction hash
    const existingPayment = await prisma.cryptoPayment.findFirst({
      where: {
        userId,
        status: "pending"
      }
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Update payment status to confirmed
    const pay = await prisma.cryptoPayment.update({
      where: { id: existingPayment.id },
      data: {
        status: "confirmed"
      }
    });

    // Notify user (payment confirmed)
    if (me.email) {
      const paymentDetails = {
        amount: existingPayment.amountDkk,
        method: `${existingPayment.symbol.toUpperCase()} (${existingPayment.network})`,
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
        <p>User ID: ${userId}${me.email ? ` (${me.email})` : ""}</p>
        <p>Symbol: ${existingPayment.symbol.toUpperCase()} — Network: ${existingPayment.network}</p>
        <p>Address: ${existingPayment.address}</p>
        <p>Amount: ${existingPayment.amountDkk} DKK (~ ${existingPayment.amountCoin} ${existingPayment.symbol.toUpperCase()})</p>
        <p>Transaction Hash: <code>${transactionHash}</code></p>
        <p>Payment ID: <code>${pay.id}</code></p>
      </div>
    `;
    await notifyAdmin(subjectAdmin, htmlAdmin).catch(() => {});

    return NextResponse.json({ ok: true, id: pay.id });
  } catch (e: any) {
    console.error("crypto/confirm failed:", e?.message || e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
