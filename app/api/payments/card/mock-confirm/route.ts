import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { notifyAdmin, notifyUserEmail } from "@/lib/notify";

export async function POST(request: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body:any = {};
  try { body = await request.json(); } catch {}

  const amountDkk = Number(body.amountDkk || 0);
  if (!amountDkk || amountDkk <= 0) {
    return NextResponse.json({ error: "amountDkk must be > 0" }, { status: 400 });
  }

  const userSubject = "تم استلام دفعتك بالبطاقة (محاكاة)";
  const userBody = `
    <div style="font-family:sans-serif">
      <h2>تم الدفع</h2>
      <p>شكرًا لك. تم استلام دفعتك بقيمة ${amountDkk} DKK.</p>
      <p>تم حجز الرحلة وبانتظار التأكيد وإرسال السيارة خلال 5 دقائق.</p>
    </div>
  `;
  await notifyUserEmail(me.email, userSubject, userBody);

  const adminSubject = "Card payment received (mock)";
  const adminBody = `
    <div style="font-family:sans-serif">
      <h2>Card Payment (Mock)</h2>
      <p>User: ${me.email}</p>
      <p>Amount: ${amountDkk} DKK</p>
    </div>
  `;
  await notifyAdmin(adminSubject, adminBody);

  return NextResponse.json({ ok: true });
}
