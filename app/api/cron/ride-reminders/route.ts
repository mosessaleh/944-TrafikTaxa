import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWAText, sendWATemplate } from '@/lib/wa-client';
import { logWAError } from '@/lib/wa-logger';

export async function GET() {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 14 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);

    const rides = await (prisma as any).ride.findMany({
      where: {
        status: 'CONFIRMED',
        scheduled: true,
        pickupTime: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, pickupTime: true, userId: true, explanation: true },
    });

    let reminded = 0;

    for (const ride of rides) {
      try {
        if (ride.explanation?.includes('[REMINDED]')) continue;

        const user = await prisma.user.findUnique({
          where: { id: ride.userId },
          select: { phone: true },
        });
        if (!user?.phone) continue;

        const pickupTime = new Date(ride.pickupTime);
        const timeStr = pickupTime.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

        const msg = `⏰ Reminder: Your ride is in 15 minutes! 🚕\n\nBooking: #${ride.id}\nTime: ${timeStr}`;

        const templateSent = await sendWATemplate(user.phone, 'ride_reminder', 'en', [
          String(ride.id),
          timeStr,
        ]);
        if (!templateSent) {
          await sendWAText(user.phone, msg);
        }

        await (prisma as any).ride.update({
          where: { id: ride.id },
          data: { explanation: `[REMINDED] ${ride.explanation || ''}` },
        });

        reminded++;
      } catch {}
    }

    return NextResponse.json({ ok: true, reminded, checked: rides.length });
  } catch (e: any) {
    logWAError('cron_reminders', e);
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}
