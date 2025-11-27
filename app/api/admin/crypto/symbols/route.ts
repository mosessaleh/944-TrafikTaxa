
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  console.log('GET /api/admin/crypto/symbols called');
  const me = await getUserFromCookie();
  console.log('User in symbols:', me);
  if (!me) {
    console.log('Forbidden: no user');
    return NextResponse.json({ error: "forbidden - no user" }, { status: 403 });
  }
  if (me.type !== 'user' || (me as any).role !== "ADMIN") {
    console.log('Forbidden: user not admin, role:', (me as any).role);
    return NextResponse.json({ error: "forbidden - not admin" }, { status: 403 });
  }
  const wallets = await prisma.cryptoWallet.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ wallets });
}
