import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
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
  minImmediatePrice: z.number().int().min(0),
  allowImmediateBooking: z.boolean(),
  allowScheduledBooking: z.boolean()
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

const SETTINGS_SCHEMA_VERSION = 2;
let ensureSettingsSchemaPromise: Promise<void> | null = null;

const SENSITIVE_PAYMENT_FIELDS = [
  'devSecretKey',
  'devWebhookSecret',
  'prodSecretKey',
  'prodWebhookSecret'
];

function maskSecret(value: unknown) {
  if (typeof value !== 'string' || !value) return value;
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function sanitizePaymentMethod(method: any) {
  if (!method || typeof method !== 'object') return method;

  const sanitized = { ...method };
  for (const field of SENSITIVE_PAYMENT_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = maskSecret(sanitized[field]);
    }
  }

  return sanitized;
}

function stripMaskedSecretsForUpdate(next: any, existing: any) {
  const data = { ...next };

  for (const field of SENSITIVE_PAYMENT_FIELDS) {
    const value = data[field];
    if (typeof value === 'string' && value.includes('...')) {
      data[field] = existing?.[field] ?? undefined;
    }
  }

  return data;
}

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

async function ensureSettingsColumns() {
  const globalSchemaVersionKey = '__adminSettingsSchemaVersion';
  if ((globalThis as any)[globalSchemaVersionKey] === SETTINGS_SCHEMA_VERSION) {
    return;
  }

  if (ensureSettingsSchemaPromise) {
    return ensureSettingsSchemaPromise;
  }

  ensureSettingsSchemaPromise = (async () => {
    // SAFE: static INFORMATION_SCHEMA query, no user input
    const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME?: string; column_name?: string }>>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'Settings'
          AND COLUMN_NAME IN (
            'minScheduledLeadMinutes',
            'minScheduledPrice',
            'minImmediatePrice',
            'allowImmediateBooking',
            'allowScheduledBooking'
          )
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
      },
      {
        name: 'allowImmediateBooking',
        sql: 'ALTER TABLE `Settings` ADD COLUMN `allowImmediateBooking` TINYINT(1) NOT NULL DEFAULT 1'
      },
      {
        name: 'allowScheduledBooking',
        sql: 'ALTER TABLE `Settings` ADD COLUMN `allowScheduledBooking` TINYINT(1) NOT NULL DEFAULT 1'
      }
    ].filter((column) => !existingColumns.has(column.name));

    for (const column of missingColumns) {
      try {
        // SAFE: static DDL statement, no user input
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
  try{ await requirePermission('settings.read'); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }

  try {
    await ensureSettingsColumns();

    const [s, schedulePolicy, paymentMethods, bookingModeRows] = await Promise.all([
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
      }),
      // SAFE: static query, no user input
      prisma.$queryRawUnsafe<Array<{ allowImmediateBooking?: unknown; allowScheduledBooking?: unknown }>>(
        'SELECT `allowImmediateBooking`, `allowScheduledBooking` FROM `Settings` WHERE `id` = 1 LIMIT 1'
      ).catch(() => [])
    ]);

    const bookingMode = Array.isArray(bookingModeRows) && bookingModeRows.length > 0
      ? bookingModeRows[0]
      : null;

    const settings = {
      ...s,
      allowImmediateBooking: normalizeBooleanFlag(
        bookingMode?.allowImmediateBooking ?? (s as any)?.allowImmediateBooking,
        true
      ),
      allowScheduledBooking: normalizeBooleanFlag(
        bookingMode?.allowScheduledBooking ?? (s as any)?.allowScheduledBooking,
        true
      )
    };

    return NextResponse.json({
      ok:true,
      settings,
      paymentMethods: paymentMethods.map(sanitizePaymentMethod),
      schedulePolicy,
      legalMaxDailyMinutes: LEGAL_MAX_DAILY_MINUTES
    });
  } catch (error: any) {
    console.error('[admin/settings][GET] failed:', error?.message || error);
    return NextResponse.json({ ok:false, error: 'Failed to load settings' }, { status:500 });
  }
}

export async function POST(req: Request){
  try{ await requirePermission('settings.manage'); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
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
      const {
        allowImmediateBooking,
        allowScheduledBooking,
        ...coreSettingsData
      } = settingsData;

      const s = await prisma.settings.upsert({
        where: { id: 1 },
        update: coreSettingsData,
        create: coreSettingsData
      });

      // SAFE: uses ? parameterized values, no user-input concatenation
      await prisma.$executeRawUnsafe(
        'UPDATE `Settings` SET `allowImmediateBooking` = ?, `allowScheduledBooking` = ? WHERE `id` = 1',
        allowImmediateBooking ? 1 : 0,
        allowScheduledBooking ? 1 : 0
      );

      return NextResponse.json({
        ok:true,
        settings: {
          ...s,
          allowImmediateBooking,
          allowScheduledBooking
        }
      });
    }

    // Handle payment method update
    if (body.paymentMethod) {
      const paymentData = PaymentMethodSchema.parse(body.paymentMethod);
      const existingPaymentMethod = await (prisma as any).paymentMethod.findUnique({
        where: { key: paymentData.key }
      });
      const updateData = stripMaskedSecretsForUpdate(paymentData, existingPaymentMethod);
      const pm = await (prisma as any).paymentMethod.upsert({
        where: { key: paymentData.key },
        update: updateData,
        create: paymentData
      });
      return NextResponse.json({ ok:true, paymentMethod: sanitizePaymentMethod(pm) });
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
