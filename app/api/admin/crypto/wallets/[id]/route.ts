import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

type Params = { params: { id: string } };

export async function PUT(request: Request, { params }: Params) {
  try{ await requirePermission('crypto.manage'); }catch(e:any){ return NextResponse.json({ error: "forbidden" }, { status: e?.status||403 }); }
  const body = await request.json().catch(() => ({}));
  const active = Boolean(body?.active);
  const id = params.id;
  await prisma.cryptoWallet.update({
    where: { id },
    data: { isActive: active }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  try{ await requirePermission('crypto.manage'); }catch(e:any){ return NextResponse.json({ error: "forbidden" }, { status: e?.status||403 }); }
  const id = params.id;
  await prisma.cryptoWallet.delete({
    where: { id }
  });
  return NextResponse.json({ ok: true });
}
