import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const driverId = parseInt(params.id);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    const body = await request.json();
    const { duration, unit } = body;

    let bannedUntil: Date | null = null;

    if (duration && unit) {
      // Ban the driver
      const now = new Date();
      switch (unit) {
        case 'hours':
          bannedUntil = new Date(now.getTime() + duration * 60 * 60 * 1000);
          break;
        case 'days':
          bannedUntil = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
          break;
        case 'weeks':
          bannedUntil = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          return NextResponse.json({ ok: false, error: 'Invalid unit' }, { status: 400 });
      }
    } else {
      // Unban the driver
      bannedUntil = null;
    }

    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: { bannedUntil },
      select: {
        id: true,
        bannedUntil: true,
      },
    });

    return NextResponse.json({
      ok: true,
      bannedUntil: updatedDriver.bannedUntil ? updatedDriver.bannedUntil.toISOString() : null,
    });
  } catch (error) {
    console.error('Error banning/unbanning driver:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}