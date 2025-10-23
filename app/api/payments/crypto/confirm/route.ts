import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { ConfirmCryptoPaymentSchema } from "@/lib/validation";
import { notifyAdmin, notifyUserEmail } from "@/lib/notify";

export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ConfirmCryptoPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const payment = await prisma.cryptoPayment.create({
    data: {
      userId: me.id,
      symbol: data.symbol,
      network: data.network,
      addressId: data.walletId,
      address: data.address,
      amountDkk: data.amountDkk,
      amountCoin: data.amountCoin,
      status: "pending",
    },
  });

  const userSubject = "تم استلام طلب الدفع بالعملات الرقمية";
  const userBody = `
    <div style="font-family:sans-serif">
      <h2>جاري معالجة طلبك</h2>
      <p>شكرًا لك. تم استلام إشعار الدفع الخاص بك (${data.symbol.toUpperCase()}).</p>
      <p>قيمة الرحلة: ${data.amountDkk} DKK • المبلغ المرسل: ${data.amountCoin} ${data.symbol.toUpperCase()}</p>
      <p>المدة المتوقعة للمعالجة: 15 دقيقة.</p>
      <p>رقم العملية: ${payment.id}</p>
    </div>
  `;
  await notifyUserEmail(me.email, userSubject, userBody);

  const adminSubject = "Crypto payment pending";
  const adminBody = `
    <div style="font-family:sans-serif">
      <h2>Payment Pending Review</h2>
      <p>User: ${me.email}</p>
      <p>Symbol: ${data.symbol.toUpperCase()} • Network: ${data.network}</p>
      <p>Address: ${data.address}</p>
      <p>Amount: ${data.amountCoin} ${data.symbol.toUpperCase()} (~ ${data.amountDkk} DKK)</p>
      <p>Payment ID: ${payment.id}</p>
    </div>
  `;
  await notifyAdmin(adminSubject, adminBody);

  return NextResponse.json({ ok: true, id: payment.id });
}
