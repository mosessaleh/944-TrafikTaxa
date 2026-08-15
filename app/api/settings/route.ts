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

export async function GET(){
  const [settings, bookingModeRows] = await Promise.all([
    prisma.settings.findFirst(),
    // SAFE: static query, no user input
    prisma.$queryRawUnsafe<Array<{ allowImmediateBooking?: unknown; allowScheduledBooking?: unknown }>>(
      'SELECT `allowImmediateBooking`, `allowScheduledBooking` FROM `Settings` WHERE `id` = 1 LIMIT 1'
    ).catch(() => [])
  ]);

  if (!settings) return NextResponse.json({ ok:false, error:'Settings not found' }, { status:404 });

  const bookingMode = Array.isArray(bookingModeRows) && bookingModeRows.length > 0
    ? bookingModeRows[0]
    : null;

  return NextResponse.json({
    ok:true,
    settings: {
      ...settings,
      allowImmediateBooking: normalizeBooleanFlag(
        bookingMode?.allowImmediateBooking ?? (settings as any)?.allowImmediateBooking,
        true
      ),
      allowScheduledBooking: normalizeBooleanFlag(
        bookingMode?.allowScheduledBooking ?? (settings as any)?.allowScheduledBooking,
        true
      )
    }
  });
}
