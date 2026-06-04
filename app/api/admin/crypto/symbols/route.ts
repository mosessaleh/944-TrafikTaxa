
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try{ await requirePermission('crypto.read'); }catch(e:any){ return NextResponse.json({ error: "forbidden" }, { status: e?.status||403 }); }
  const wallets = await prisma.cryptoWallet.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ wallets });
}
