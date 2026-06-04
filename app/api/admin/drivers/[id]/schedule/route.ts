import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const {
  DAY_NAMES,
  minuteToHHmm,
  parseTimeToMinute,
  getDriverScheduleTemplate,
  getDriverSchedulePreferences,
  getDriverScheduleSnapshot,
  upsertDriverScheduleTemplate,
  isTemplateEditLocked,
} = require('@/lib/driver-schedule');

type ScheduleWindowInput = {
  start?: string;
  end?: string;
  startMinute?: number;
  endMinute?: number;
  isActive?: boolean;
};

type TemplatePatchInput = {
  dayOfWeek?: number;
  windows?: ScheduleWindowInput[];
};

function buildSuccess(data: any, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

function buildError(message: string, status = 400, details?: any) {
  return NextResponse.json({ ok: false, error: message, details: details || null }, { status });
}

function windowDurationMinutes(startMinute: number, endMinute: number) {
  if (endMinute > startMinute) return endMinute - startMinute;
  return (1440 - startMinute) + endMinute;
}

function normalizeWindows(windows: ScheduleWindowInput[], maxDailyMinutes = 11 * 60) {
  const output: Array<{ startMinute: number; endMinute: number; isActive: boolean }> = [];

  for (const window of windows) {
    const resolvedStart = Number.isInteger(window.startMinute)
      ? Number(window.startMinute)
      : parseTimeToMinute(String(window.start || '').trim());

    const resolvedEnd = Number.isInteger(window.endMinute)
      ? Number(window.endMinute)
      : parseTimeToMinute(String(window.end || '').trim());

    if (!Number.isInteger(resolvedStart) || !Number.isInteger(resolvedEnd)) {
      throw new Error('Each window requires valid start/end times');
    }

    if (resolvedStart < 0 || resolvedStart > 1439 || resolvedEnd < 0 || resolvedEnd > 1439) {
      throw new Error('Window minutes must be between 00:00 and 23:59');
    }

    if (resolvedStart === resolvedEnd) {
      throw new Error('Window start and end cannot be identical');
    }

    const durationMinutes = windowDurationMinutes(resolvedStart, resolvedEnd);
    if (durationMinutes > maxDailyMinutes) {
      throw new Error(`Window exceeds daily maximum (${maxDailyMinutes} minutes)`);
    }

    output.push({
      startMinute: resolvedStart,
      endMinute: resolvedEnd,
      isActive: window.isActive !== false,
    });
  }

  output.sort((a, b) => (a.startMinute - b.startMinute) || (a.endMinute - b.endMinute));

  const expanded = output.map((window) => {
    if (window.endMinute > window.startMinute) {
      return [{ startMinute: window.startMinute, endMinute: window.endMinute }];
    }
    return [
      { startMinute: window.startMinute, endMinute: 1440 },
      { startMinute: 0, endMinute: window.endMinute },
    ];
  }).flat();

  expanded.sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < expanded.length; i += 1) {
    if (expanded[i].startMinute < expanded[i - 1].endMinute) {
      throw new Error('Schedule windows overlap. Please adjust times.');
    }
  }

  const totalDurationMinutes = output.reduce(
    (sum, window) => sum + windowDurationMinutes(window.startMinute, window.endMinute),
    0
  );
  if (totalDurationMinutes > maxDailyMinutes) {
    throw new Error(`Total daily schedule exceeds maximum (${maxDailyMinutes} minutes)`);
  }

  return output;
}

function toTemplateResponse(rows: any[]) {
  const byDay: Record<number, Array<{ startMinute: number; endMinute: number; start: string; end: string; isActive: boolean }>> = {};
  for (let day = 0; day < 7; day += 1) {
    byDay[day] = [];
  }

  for (const row of rows) {
    byDay[row.dayOfWeek].push({
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      start: minuteToHHmm(row.startMinute),
      end: minuteToHHmm(row.endMinute),
      isActive: Boolean(row.isActive),
    });
  }

  const days = Object.keys(byDay).map((key) => {
    const dayOfWeek = Number(key);
    return {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      windows: byDay[dayOfWeek],
    };
  });

  return days;
}

async function ensureAdmin(request: NextRequest) {
  const originCheck = validateRequestOrigin(request as any);
  if (!originCheck.ok) {
    return buildError('Invalid request origin', 403);
  }

  try {
    await requirePermission('drivers.manage');
    return null;
  } catch (error: any) {
    return buildError('Unauthorized', error?.status || 403);
  }
}

function parseDriverId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const adminError = await ensureAdmin(request);
  if (adminError) return adminError;

  const driverId = parseDriverId(params.id);
  if (!driverId) return buildError('Invalid driver ID', 400);

  try {
    const now = new Date();

    const [driver, templateRows, preferences, lockStatus, snapshot] = await Promise.all([
      prisma.comDriver.findUnique({
        where: { id: driverId },
        select: { id: true, drFname: true, drLname: true, drCard: true },
      }),
      getDriverScheduleTemplate(prisma, driverId),
      getDriverSchedulePreferences(prisma, driverId),
      isTemplateEditLocked(prisma, driverId, now),
      getDriverScheduleSnapshot(prisma, driverId, now),
    ]);

    if (!driver) {
      return buildError('Driver not found', 404);
    }

    return buildSuccess({
      driver,
      serverTime: now.toISOString(),
      template: toTemplateResponse(templateRows),
      preferences,
      lockStatus,
      eligibility: snapshot,
    });
  } catch (error: any) {
    console.error('Admin driver schedule GET error:', error);
    return buildError(error?.message || 'Failed to load driver schedule', 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const adminError = await ensureAdmin(request);
  if (adminError) return adminError;

  const driverId = parseDriverId(params.id);
  if (!driverId) return buildError('Invalid driver ID', 400);

  try {
    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action !== 'setTemplate') {
      return buildError('Unsupported action');
    }

    const driverExists = await prisma.comDriver.findUnique({ where: { id: driverId }, select: { id: true } });
    if (!driverExists) {
      return buildError('Driver not found', 404);
    }

    const patches: TemplatePatchInput[] = Array.isArray(body?.days) ? body.days : [];
    if (!patches.length) {
      return buildError('days array is required for setTemplate');
    }

    const now = new Date();
    const lockStatus = await isTemplateEditLocked(prisma, driverId, now);
    if (lockStatus.locked) {
      return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
    }

    const preferences = await getDriverSchedulePreferences(prisma, driverId);
    const maxDailyMinutes = Math.min(11 * 60, Number(preferences?.maxDailyMinutes) || 11 * 60);

    const existingRows = await getDriverScheduleTemplate(prisma, driverId);
    const dayMap = new Map<number, any[]>();
    for (let day = 0; day < 7; day += 1) {
      dayMap.set(day, existingRows.filter((row: any) => row.dayOfWeek === day));
    }

    for (const patch of patches) {
      const dayOfWeek = Number(patch.dayOfWeek);
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('Each day patch requires dayOfWeek between 0 and 6');
      }

      const normalized = normalizeWindows(
        Array.isArray(patch.windows) ? patch.windows : [],
        maxDailyMinutes
      );

      dayMap.set(dayOfWeek, normalized.map((window) => ({
        dayOfWeek,
        ...window,
      })));
    }

    const finalRows = Array.from(dayMap.entries())
      .flatMap(([dayOfWeek, windows]) => windows.map((window: any) => ({
        dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        isActive: window.isActive !== false,
      })));

    const saved = await upsertDriverScheduleTemplate(prisma, driverId, finalRows);
    const snapshot = await getDriverScheduleSnapshot(prisma, driverId, now);

    return buildSuccess({
      message: 'Driver template schedule updated',
      template: toTemplateResponse(saved),
      eligibility: snapshot,
    });
  } catch (error: any) {
    console.error('Admin driver schedule POST error:', error);
    return buildError(error?.message || 'Failed to update driver schedule', 500);
  }
}

export async function PUT(request: NextRequest, context: { params: { id: string } }) {
  return POST(request, context);
}
