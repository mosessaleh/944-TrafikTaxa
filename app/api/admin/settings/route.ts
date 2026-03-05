import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const {
  getDriverScheduleAdminPolicy,
  upsertDriverScheduleAdminPolicy,
  LEGAL_MAX_DAILY_MINUTES
} = require('@/lib/driver-schedule');

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
  immediateCancellationFee: z.number().min(0),
  minScheduledLeadMinutes: z.number().int().min(0).max(90 * 24 * 60),
  minScheduledPrice: z.number().int().min(0),
  minImmediatePrice: z.number().int().min(0)
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

const SchedulePolicySchema = z.object({
  maxDailyMinutes: z.number().int().min(60).max(LEGAL_MAX_DAILY_MINUTES),
  maxWeeklyMinutes: z.number().int().min(60).max(90 * 60),
  minRestMinutes: z.number().int().min(0).max(24 * 60),
  lockMinutesBeforeStart: z.number().int().min(0).max(24 * 60),
  allowEmergencyOverride: z.boolean()
}).superRefine((value, ctx) => {
  if (value.maxWeeklyMinutes < value.maxDailyMinutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxWeeklyMinutes'],
      message: 'maxWeeklyMinutes must be greater than or equal to maxDailyMinutes'
    });
  }
});

const SETTINGS_SCHEMA_VERSION = 1;
let ensureSettingsSchemaPromise: Promise<void> | null = null;

async function ensureSettingsColumns() {
  const globalSchemaVersionKey = '__adminSettingsSchemaVersion';
  if ((globalThis as any)[globalSchemaVersionKey] === SETTINGS_SCHEMA_VERSION) {
    return;
  }

  if (ensureSettingsSchemaPromise) {
    return ensureSettingsSchemaPromise;
  }

  ensureSettingsSchemaPromise = (async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME?: string; column_name?: string }>>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Settings'
          AND COLUMN_NAME IN ('minScheduledLeadMinutes', 'minScheduledPrice', 'minImmediatePrice')
      `
    );

    const existingColumns = new Set(
      (Array.isArray(rows) ? rows : [])
        .map((r) => String(r?.COLUMN_NAME || r?.column_name || ''))
        .filter(Boolean)
    );

    const missingColumns = [
      {
        name: 'minScheduledLeadMinutes',
        sql: 'ALTER TABLE `Settings` ADD COLUMN `minScheduledLeadMinutes` INT NOT NULL DEFAULT 60'
      },
      {
        name: 'minScheduledPrice',
        sql: 'ALTER TABLE `Settings` ADD COLUMN `minScheduledPrice` INT NOT NULL DEFAULT 0'
      },
      {
        name: 'minImmediatePrice',
        sql: 'ALTER TABLE `Settings` ADD COLUMN `minImmediatePrice` INT NOT NULL DEFAULT 0'
      }
    ].filter((column) => !existingColumns.has(column.name));

    for (const column of missingColumns) {
      try {
        await prisma.$executeRawUnsafe(column.sql);
      } catch (error: any) {
        const mysqlCode = Number(error?.meta?.code || error?.errno || 0);
        const message = String(error?.message || '').toLowerCase();
        const duplicateColumn = mysqlCode === 1060 || message.includes('duplicate column');
        if (!duplicateColumn) {
          throw error;
        }
      }
    }

    (globalThis as any)[globalSchemaVersionKey] = SETTINGS_SCHEMA_VERSION;
  })();

  try {
    await ensureSettingsSchemaPromise;
  } finally {
    ensureSettingsSchemaPromise = null;
  }
}

export async function GET(){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }

  try {
    await ensureSettingsColumns();

    const [s, schedulePolicy, paymentMethods] = await Promise.all([
      prisma.settings.upsert({
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
          immediateCancellationFee: 50,
          minScheduledLeadMinutes: 60,
          minScheduledPrice: 0,
          minImmediatePrice: 0
        }
      }),
      getDriverScheduleAdminPolicy(prisma),
      (prisma as any).paymentMethod.findMany({
        orderBy: { createdAt: 'asc' }
      }).catch((error: any) => {
        // Keep settings page working even if PaymentMethod table/client is unavailable
        console.warn('[admin/settings] payment methods unavailable:', error?.message || error);
        return [];
      })
    ]);

    return NextResponse.json({
      ok:true,
      settings: s,
      paymentMethods,
      schedulePolicy,
      legalMaxDailyMinutes: LEGAL_MAX_DAILY_MINUTES
    });
  } catch (error: any) {
    console.error('[admin/settings][GET] failed:', error?.message || error);
    return NextResponse.json({ ok:false, error: 'Failed to load settings' }, { status:500 });
  }
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
  try {
    await ensureSettingsColumns();

    const body = await req.json();

    // Handle schedule policy update
    if (body.schedulePolicy) {
      const schedulePolicyData = SchedulePolicySchema.parse(body.schedulePolicy);
      const policy = await upsertDriverScheduleAdminPolicy(prisma, schedulePolicyData);
      return NextResponse.json({
        ok: true,
        schedulePolicy: policy,
        legalMaxDailyMinutes: LEGAL_MAX_DAILY_MINUTES
      });
    }

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
      const pm = await (prisma as any).paymentMethod.upsert({
        where: { key: paymentData.key },
        update: paymentData,
        create: paymentData
      });
      return NextResponse.json({ ok:true, paymentMethod: pm });
    }

    return NextResponse.json({ ok:false, error: 'Invalid request' }, { status:400 });
  } catch (error: any) {
    console.error('[admin/settings][POST] failed:', error?.message || error);
    if (error?.name === 'ZodError') {
      return NextResponse.json({ ok:false, error: 'Validation failed', issues: error.issues }, { status:400 });
    }
    return NextResponse.json({ ok:false, error: 'Failed to save settings' }, { status:500 });
  }
}
