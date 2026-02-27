import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT } from '@/lib/auth';

const {
  DAY_NAMES,
  minuteToHHmm,
  parseTimeToMinute,
  toLocalDateString,
  getDriverScheduleTemplate,
  getDriverSchedulePreferences,
  getDriverScheduleExceptions,
  getDriverScheduleSnapshot,
  getDriverScheduleSuggestions,
  upsertDriverScheduleTemplate,
  upsertDriverScheduleException,
  deleteDriverScheduleException,
  isTemplateEditLocked
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
      isActive: window.isActive !== false
    });
  }

  output.sort((a, b) => (a.startMinute - b.startMinute) || (a.endMinute - b.endMinute));

  // overlap validation (only for non-overnight intervals inside same day for MVP safety)
  const expanded = output.map((window) => {
    if (window.endMinute > window.startMinute) {
      return [{ startMinute: window.startMinute, endMinute: window.endMinute }];
    }
    // overnight split to [start, 1440) + [0, end)
    return [
      { startMinute: window.startMinute, endMinute: 1440 },
      { startMinute: 0, endMinute: window.endMinute }
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
      isActive: Boolean(row.isActive)
    });
  }

  const days = Object.keys(byDay).map((key) => {
    const dayOfWeek = Number(key);
    return {
      dayOfWeek,
      dayName: DAY_NAMES[dayOfWeek],
      windows: byDay[dayOfWeek]
    };
  });

  return days;
}

function buildNext14DayPlan(now: Date, templateRows: any[], exceptions: any[]) {
  const byDay: Record<number, any[]> = {};
  for (let day = 0; day < 7; day += 1) {
    byDay[day] = [];
  }
  for (const row of templateRows) {
    if (row.isActive) {
      byDay[row.dayOfWeek].push({
        startMinute: row.startMinute,
        endMinute: row.endMinute,
        start: minuteToHHmm(row.startMinute),
        end: minuteToHHmm(row.endMinute)
      });
    }
  }

  const exceptionMap = new Map<string, any>();
  for (const exception of exceptions) {
    exceptionMap.set(exception.date, exception);
  }

  const plan: any[] = [];
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  for (let i = 0; i < 14; i += 1) {
    const date = new Date(dayStart);
    date.setDate(dayStart.getDate() + i);
    const dateText = toLocalDateString(date);
    const dow = date.getDay();
    const exception = exceptionMap.get(dateText) || null;

    let windows = byDay[dow] || [];
    let mode = 'template';

    if (exception) {
      mode = `exception:${String(exception.type || '').toLowerCase()}`;
      if (['OFF', 'LEAVE', 'SICK'].includes(exception.type)) {
        windows = [];
      } else if (exception.type === 'CUSTOM') {
        if (Number.isInteger(exception.startMinute) && Number.isInteger(exception.endMinute) && exception.startMinute !== exception.endMinute) {
          windows = [{
            startMinute: exception.startMinute,
            endMinute: exception.endMinute,
            start: minuteToHHmm(exception.startMinute),
            end: minuteToHHmm(exception.endMinute)
          }];
        } else {
          windows = [];
        }
      }
    }

    plan.push({
      date: dateText,
      dayOfWeek: dow,
      dayName: DAY_NAMES[dow],
      mode,
      windows,
      exception: exception
        ? {
            id: exception.id,
            type: exception.type,
            note: exception.note,
            startMinute: exception.startMinute,
            endMinute: exception.endMinute,
            start: exception.startMinute === null ? null : minuteToHHmm(exception.startMinute),
            end: exception.endMinute === null ? null : minuteToHHmm(exception.endMinute)
          }
        : null
    });
  }

  return plan;
}

export async function GET(req: NextRequest) {
  let driver;
  try {
    driver = await requireDriverByJWT(req as any);
  } catch (error: any) {
    return buildError('Unauthorized', error?.status || 401);
  }

  try {
    const now = new Date();
    const templateRows = await getDriverScheduleTemplate(prisma, driver.id);
    const preferences = await getDriverSchedulePreferences(prisma, driver.id);
    const exceptions = await getDriverScheduleExceptions(prisma, driver.id, {
      fromDate: toLocalDateString(now),
      toDate: toLocalDateString(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30))
    });
    const snapshot = await getDriverScheduleSnapshot(prisma, driver.id, now);
    const lockStatus = await isTemplateEditLocked(prisma, driver.id, now);

    return buildSuccess({
      driverId: Number(driver.id),
      serverTime: now.toISOString(),
      template: toTemplateResponse(templateRows),
      preferences,
      exceptions,
      eligibility: snapshot,
      lockStatus,
      next14Days: buildNext14DayPlan(now, templateRows, exceptions)
    });
  } catch (error: any) {
    console.error('Driver schedule GET error:', error);
    return buildError(error?.message || 'Failed to load driver schedule', 500);
  }
}

export async function POST(req: NextRequest) {
  let driver;
  try {
    driver = await requireDriverByJWT(req as any);
  } catch (error: any) {
    return buildError('Unauthorized', error?.status || 401);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || '').trim();
    const now = new Date();

    if (action === 'setTemplate') {
      const patches: TemplatePatchInput[] = Array.isArray(body?.days) ? body.days : [];
      if (!patches.length) {
        return buildError('days array is required for setTemplate');
      }

      const lockStatus = await isTemplateEditLocked(prisma, driver.id, now);
      if (lockStatus.locked) {
        return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
      }

      const preferences = await getDriverSchedulePreferences(prisma, driver.id);
      const maxDailyMinutes = Math.min(11 * 60, Number(preferences?.maxDailyMinutes) || 11 * 60);

      const existingRows = await getDriverScheduleTemplate(prisma, driver.id);
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
          ...window
        })));
      }

      const finalRows = Array.from(dayMap.entries())
        .flatMap(([dayOfWeek, windows]) => windows.map((window: any) => ({
          dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
          isActive: window.isActive !== false
        })));

      const saved = await upsertDriverScheduleTemplate(prisma, driver.id, finalRows);
      const snapshot = await getDriverScheduleSnapshot(prisma, driver.id, now);

      return buildSuccess({
        message: 'Template schedule updated',
        template: toTemplateResponse(saved),
        eligibility: snapshot
      });
    }

    if (action === 'setPreferences') {
      return buildError('Only admin can update schedule preferences', 403, {
        action: 'setPreferences',
        scope: 'ADMIN_ONLY'
      });
    }

    if (action === 'setException') {
      const lockStatus = await isTemplateEditLocked(prisma, driver.id, now);
      if (lockStatus.locked) {
        return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
      }

      const date = String(body?.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return buildError('date must be YYYY-MM-DD');
      }

      const type = String(body?.type || '').toUpperCase();
      if (!['OFF', 'LEAVE', 'SICK', 'CUSTOM', 'EMERGENCY'].includes(type)) {
        return buildError('type must be one of OFF, LEAVE, SICK, CUSTOM, EMERGENCY');
      }

      let startMinute: number | null = null;
      let endMinute: number | null = null;
      if (type === 'CUSTOM') {
        startMinute = Number.isInteger(body?.startMinute)
          ? Number(body.startMinute)
          : parseTimeToMinute(String(body?.start || '').trim());
        endMinute = Number.isInteger(body?.endMinute)
          ? Number(body.endMinute)
          : parseTimeToMinute(String(body?.end || '').trim());

        if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute === endMinute) {
          return buildError('CUSTOM exception requires valid start/end values');
        }

        const preferences = await getDriverSchedulePreferences(prisma, driver.id);
        const maxDailyMinutes = Math.min(11 * 60, Number(preferences?.maxDailyMinutes) || 11 * 60);
        const durationMinutes = windowDurationMinutes(startMinute as number, endMinute as number);
        if (durationMinutes > maxDailyMinutes) {
          return buildError(`CUSTOM exception exceeds daily maximum (${maxDailyMinutes} minutes)`);
        }
      }

      await upsertDriverScheduleException(prisma, driver.id, {
        date,
        type,
        startMinute,
        endMinute,
        note: body?.note || null
      });

      const exceptions = await getDriverScheduleExceptions(prisma, driver.id, {
        fromDate: toLocalDateString(now),
        toDate: toLocalDateString(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30))
      });
      const snapshot = await getDriverScheduleSnapshot(prisma, driver.id, now);

      return buildSuccess({
        message: 'Schedule exception saved',
        exceptions,
        eligibility: snapshot
      });
    }

    if (action === 'deleteException') {
      const lockStatus = await isTemplateEditLocked(prisma, driver.id, now);
      if (lockStatus.locked) {
        return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
      }

      const date = String(body?.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return buildError('date must be YYYY-MM-DD');
      }

      await deleteDriverScheduleException(prisma, driver.id, date);

      const exceptions = await getDriverScheduleExceptions(prisma, driver.id, {
        fromDate: toLocalDateString(now),
        toDate: toLocalDateString(new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30))
      });
      const snapshot = await getDriverScheduleSnapshot(prisma, driver.id, now);

      return buildSuccess({
        message: 'Schedule exception deleted',
        exceptions,
        eligibility: snapshot
      });
    }

    if (action === 'applySuggestions') {
      const lockStatus = await isTemplateEditLocked(prisma, driver.id, now);
      if (lockStatus.locked) {
        return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
      }

      const preferences = await getDriverSchedulePreferences(prisma, driver.id);
      const maxDailyMinutes = Math.min(11 * 60, Number(preferences?.maxDailyMinutes) || 11 * 60);

      const suggestionsPayload = await getDriverScheduleSuggestions(prisma, driver.id, {
        now,
        daysBack: Number(body?.daysBack) || 42
      });

      const suggestedRows = suggestionsPayload.suggestions.flatMap((day: any) => {
        const windows = Array.isArray(day.windows) ? day.windows : [];
        return windows.map((window: any) => ({
          dayOfWeek: Number(day.dayOfWeek),
          startMinute: Number(window.startMinute),
          endMinute: (() => {
            const startMinute = Number(window.startMinute);
            const endMinute = Number(window.endMinute);
            const duration = windowDurationMinutes(startMinute, endMinute);
            if (duration <= maxDailyMinutes) return endMinute;
            return (startMinute + maxDailyMinutes) % 1440;
          })(),
          isActive: true
        }));
      });

      const saved = await upsertDriverScheduleTemplate(prisma, driver.id, suggestedRows);
      const snapshot = await getDriverScheduleSnapshot(prisma, driver.id, now);

      return buildSuccess({
        message: 'Suggested schedule applied',
        source: suggestionsPayload.source,
        template: toTemplateResponse(saved),
        eligibility: snapshot
      });
    }

    return buildError('Unsupported action');
  } catch (error: any) {
    console.error('Driver schedule POST error:', error);
    return buildError(error?.message || 'Failed to update driver schedule', 500);
  }
}

export async function PUT(req: NextRequest) {
  // alias to POST for clients that use PUT semantics
  return POST(req);
}

export async function DELETE(req: NextRequest) {
  let driver;
  try {
    driver = await requireDriverByJWT(req as any);
  } catch (error: any) {
    return buildError('Unauthorized', error?.status || 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const date = String(body?.date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return buildError('date must be YYYY-MM-DD');
    }

    const lockStatus = await isTemplateEditLocked(prisma, driver.id, new Date());
    if (lockStatus.locked) {
      return buildError(lockStatus.reasonMessage || 'Schedule is locked for editing at this time', 409, lockStatus);
    }

    await deleteDriverScheduleException(prisma, driver.id, date);
    return buildSuccess({ message: 'Schedule exception deleted' });
  } catch (error: any) {
    console.error('Driver schedule DELETE error:', error);
    return buildError(error?.message || 'Failed to delete schedule exception', 500);
  }
}

