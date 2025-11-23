import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const maxId = await prisma.partnerCompany.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' }
    });
    const nextId = (maxId?.id || 0) + 1;
    return NextResponse.json({ ok: true, nextId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to get next ID' }, { status: 500 });
  }
}