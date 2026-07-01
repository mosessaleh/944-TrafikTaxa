import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requirePermission('messages.read');
  } catch {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const rideId = searchParams.get('rideId');
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000);

  try {
    const where: any = {};
    if (rideId) where.rideId = Number(rideId);

    const messages = await (prisma as any).chatMessage.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json({ ok: true, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requirePermission('danger.manage');
  } catch {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const rideId = searchParams.get('rideId');

    if (rideId) {
      await (prisma as any).chatMessage.deleteMany({
        where: { rideId: Number(rideId) },
      });
      return NextResponse.json({ ok: true, message: `Messages for ride #${rideId} deleted` });
    }

    await (prisma as any).chatMessage.deleteMany({});
    return NextResponse.json({ ok: true, message: 'All messages deleted' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
