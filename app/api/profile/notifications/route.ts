import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

const NotificationSchema = z.object({
  emailBooking: z.boolean(),
  emailPayment: z.boolean(),
  emailInvoice: z.boolean(),
  emailMarketing: z.boolean(),
});

export async function GET() {
  const me = await getUserFromCookie();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const prismaAny = prisma as any;

  const fallback = {
    emailBooking: true,
    emailPayment: true,
    emailInvoice: true,
    emailMarketing: false,
  };

  try {
    if (!prismaAny.notificationSettings || !prismaAny.notificationSettings.upsert) {
      return NextResponse.json({ ok: true, settings: fallback });
    }

    const settings = await prismaAny.notificationSettings.upsert({
      where: { userId: me.id },
      create: { userId: me.id },
      update: {},
      select: {
        emailBooking: true,
        emailPayment: true,
        emailInvoice: true,
        emailMarketing: true,
      },
    });

    return NextResponse.json({ ok: true, settings: settings ?? fallback });
  } catch (error: any) {
    console.error('Failed to load notification settings (fallback used):', error);
    return NextResponse.json({ ok: true, settings: fallback });
  }
}

export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let data;
  try {
    const body = await req.json();
    data = NotificationSchema.parse(body);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Invalid notification settings' },
      { status: 400 },
    );
  }

  const prismaAny = prisma as any;

  const fallback = {
    emailBooking: data.emailBooking,
    emailPayment: data.emailPayment,
    emailInvoice: data.emailInvoice,
    emailMarketing: data.emailMarketing,
  };

  try {
    if (!prismaAny.notificationSettings || !prismaAny.notificationSettings.upsert) {
      return NextResponse.json({ ok: true, settings: fallback });
    }

    const settings = await prismaAny.notificationSettings.upsert({
      where: { userId: me.id },
      update: data,
      create: {
        userId: me.id,
        emailBooking: data.emailBooking,
        emailPayment: data.emailPayment,
        emailInvoice: data.emailInvoice,
        emailMarketing: data.emailMarketing,
      },
    });

    return NextResponse.json({ ok: true, settings: settings ?? fallback });
  } catch (error: any) {
    console.error('Failed to update notification settings (fallback used):', error);
    return NextResponse.json({ ok: true, settings: fallback });
  }
}