import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await requirePermission('messages.read');
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const direction = searchParams.get('direction') || undefined;
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const phone = searchParams.get('phone') || undefined;

    const where: any = {};

    if (direction && ['inbound', 'outbound'].includes(direction)) where.direction = direction;
    if (status && ['sent', 'delivered', 'read', 'failed'].includes(status)) where.status = status;
    if (type && ['text', 'template', 'interactive', 'notification'].includes(type)) where.type = type;
    if (phone) where.phone = { contains: phone };

    const [total, messages] = await Promise.all([
      (prisma as any).whatsAppMessage.count({ where }),
      (prisma as any).whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Stats
    const [totalInbound, totalOutbound, failedCount] = await Promise.all([
      (prisma as any).whatsAppMessage.count({ where: { direction: 'inbound' } }),
      (prisma as any).whatsAppMessage.count({ where: { direction: 'outbound' } }),
      (prisma as any).whatsAppMessage.count({ where: { status: 'failed' } }),
    ]);

    return NextResponse.json({
      ok: true,
      messages,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalInbound,
        totalOutbound,
        failedCount,
        totalCount: totalInbound + totalOutbound,
      },
    });
  } catch (e: any) {
    console.error('[WA Admin API]', e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
