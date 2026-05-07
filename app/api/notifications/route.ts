import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.type !== 'user') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        data: true,
        read: true,
        createdAt: true,
      },
    });

    const unreadCount = notifications.filter((item) => !item.read).length;

    return NextResponse.json({
      ok: true,
      notifications: notifications.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('[API] Error fetching notifications:', error);
    return NextResponse.json({ ok: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user || user.type !== 'user') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const notificationId = Number(body?.notificationId);
    const markAll = body?.markAll === true;

    if (markAll) {
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          read: false,
        },
        data: { read: true },
      });

      return NextResponse.json({ ok: true, markedAll: true });
    }

    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return NextResponse.json({ ok: false, error: 'Valid notificationId is required' }, { status: 400 });
    }

    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
      },
      data: { read: true },
    });

    return NextResponse.json({ ok: true, notificationId });
  } catch (error) {
    console.error('[API] Error marking notifications as read:', error);
    return NextResponse.json({ ok: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
