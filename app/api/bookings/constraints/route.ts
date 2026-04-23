import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function normalizeBooleanFlag(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

export async function GET() {
  try {
    const [settings, bookingModeRows] = await Promise.all([
      prisma.settings.findUnique({ where: { id: 1 } }),
      prisma.$queryRawUnsafe<Array<{ allowImmediateBooking?: unknown; allowScheduledBooking?: unknown }>>(
        'SELECT `allowImmediateBooking`, `allowScheduledBooking` FROM `Settings` WHERE `id` = 1 LIMIT 1'
      ).catch(() => []),
    ]);

    const bookingMode = Array.isArray(bookingModeRows) && bookingModeRows.length > 0
      ? bookingModeRows[0]
      : null;

    return NextResponse.json({
      ok: true,
      controls: {
        allowImmediateBooking: normalizeBooleanFlag(
          bookingMode?.allowImmediateBooking ?? (settings as any)?.allowImmediateBooking,
          true
        ),
        allowScheduledBooking: normalizeBooleanFlag(
          bookingMode?.allowScheduledBooking ?? (settings as any)?.allowScheduledBooking,
          true
        ),
        minScheduledLeadMinutes: Math.max(0, Math.round(Number((settings as any)?.minScheduledLeadMinutes || 60))),
        minScheduledPrice: Math.max(0, Math.round(Number((settings as any)?.minScheduledPrice || 0))),
        minImmediatePrice: Math.max(0, Math.round(Number((settings as any)?.minImmediatePrice || 0))),
        maxScheduledDays: 90,
        scheduledMinuteStep: 15,
        minRouteDistanceKm: 0.1,
      },
    });
  } catch (error) {
    console.error('[bookings/constraints] failed:', error);
    return NextResponse.json({ ok: false, error: 'Failed to load booking constraints' }, { status: 500 });
  }
}
