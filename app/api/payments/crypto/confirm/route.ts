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
    const { symbol, walletId, network, address, amountDkk, amountCoin } = parsed.data;

    // Prisma expects string userId
    const userId = String(me.id);

    const pay = await prisma.cryptoPayment.create({
      data: {
        userId,
        symbol,
        network,
        addressId: walletId || null,
        address,
        amountDkk: Number(amountDkk),
        amountCoin: Number(amountCoin),
        status: "pending",
      },
    });

    // Notify user (processing ~15 minutes)
    if (me.email) {
      const paymentDetails = {
        amount: amountDkk,
        method: `${symbol.toUpperCase()} (${network})`,
        transactionId: pay.id,
        bookingId: 'TBD' // This would need to be passed from the booking context
      };
      await notifyUserPaymentReceived(me.email, me.firstName, paymentDetails).catch(() => {});
    }

    // Notify admin
    const subjectAdmin = "Crypto payment pending verification";
    const htmlAdmin = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
        <h2>Crypto Payment Pending</h2>
        <p>User ID: ${userId}${me.email ? ` (${me.email})` : ""}</p>
        <p>Symbol: ${symbol.toUpperCase()} — Network: ${network}</p>
        <p>Address: ${address}</p>
        <p>Amount: ${amountDkk} DKK (~ ${amountCoin} ${symbol.toUpperCase()})</p>
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
