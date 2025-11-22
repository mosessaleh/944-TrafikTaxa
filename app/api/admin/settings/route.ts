import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const Schema = z.object({
  brandName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(3),
  addressCity: z.string().min(1),
  dayBase: z.number().positive(),
  dayPerKm: z.number().positive(),
  dayPerMin: z.number().positive(),
  nightBase: z.number().positive(),
  nightPerKm: z.number().positive(),
  nightPerMin: z.number().positive(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  discountPercentage: z.number().min(0).max(100),
  maxDiscountAmount: z.number().min(0),
  scheduledCancellationFee1: z.number().min(0).max(100),
  scheduledCancellationFee2: z.number().min(0).max(100),
  scheduledCancellationFee3: z.number().min(0).max(100),
  immediateCancellationFee: z.number().min(0)
});

const PaymentMethodSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean(),
  devPublicKey: z.string().optional(),
  devSecretKey: z.string().optional(),
  devWebhookSecret: z.string().optional(),
  prodPublicKey: z.string().optional(),
  prodSecretKey: z.string().optional(),
  prodWebhookSecret: z.string().optional(),
  devClientId: z.string().optional(),
  prodClientId: z.string().optional(),
  devApiUrl: z.string().optional(),
  prodApiUrl: z.string().optional()
});

export async function GET(){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      brandName: process.env.BRAND_NAME || '944 Trafik',
      contactEmail: process.env.CONTACT_EMAIL || 'trafik@944.dk',
      contactPhone: process.env.CONTACT_PHONE || '26444944',
      addressCity: process.env.ADDRESS_CITY || 'Frederikssund',
      dayBase: 40, dayPerKm: 12.75, dayPerMin: 5.75,
      nightBase: 60, nightPerKm: 16, nightPerMin: 7,
      workStart: '06:00', workEnd: '18:00',
      discountPercentage: 0, maxDiscountAmount: 0,
      scheduledCancellationFee1: 0,
      scheduledCancellationFee2: 25,
      scheduledCancellationFee3: 50,
      immediateCancellationFee: 50
    }
  });

  // Get payment methods
  const paymentMethods = await prisma.paymentMethod.findMany({
    orderBy: { createdAt: 'asc' }
  });

  return NextResponse.json({ ok:true, settings: s, paymentMethods });
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
  const body = await req.json();

  // Handle settings update
  if (body.settings) {
    const settingsData = Schema.parse(body.settings);
    const s = await prisma.settings.upsert({
      where: { id: 1 },
      update: settingsData,
      create: settingsData
    });
    return NextResponse.json({ ok:true, settings: s });
  }

  // Handle payment method update
  if (body.paymentMethod) {
    const paymentData = PaymentMethodSchema.parse(body.paymentMethod);
    const pm = await prisma.paymentMethod.upsert({
      where: { key: paymentData.key },
      update: paymentData,
      create: paymentData
    });
    return NextResponse.json({ ok:true, paymentMethod: pm });
  }

  return NextResponse.json({ ok:false, error: 'Invalid request' }, { status:400 });
}
