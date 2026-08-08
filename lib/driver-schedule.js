const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LEGAL_MAX_DAILY_MINUTES = 11 * 60;
const DRIVER_SCHEDULE_SCHEMA_VERSION = 2;

const DEFAULT_DRIVER_SCHEDULE_PREFERENCES = Object.freeze({
  maxDailyMinutes: 10 * 60,
  maxWeeklyMinutes: 56 * 60,
  minRestMinutes: 11 * 60,
  lockMinutesBeforeStart: 30,
  allowEmergencyOverride: true
});

const DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY = Object.freeze({
  maxDailyMinutes: LEGAL_MAX_DAILY_MINUTES,
  maxWeeklyMinutes: 56 * 60,
  minRestMinutes: 11 * 60,
  lockMinutesBeforeStart: 30,
  allowEmergencyOverride: true
});

const ELIGIBILITY_CACHE_MS_STRICT = 15000;
const ELIGIBILITY_CACHE_MS_LIGHT = 30000;
const eligibilityCache = new Map();
let ensureDriverScheduleTablesPromise = null;

function isMissingTableError(error, tableName) {
  const prismaCode = error?.code;
  const mysqlCode = Number(error?.meta?.code || error?.errno || 0);
  const rawMessage = String(error?.meta?.message || error?.message || '');
  const message = rawMessage.toLowerCase();

  if (!message.includes("doesn't exist") && mysqlCode !== 1146 && prismaCode !== 'P2010') {
    return false;
  }

  if (!tableName) {
    return true;
  }

  return message.includes(String(tableName).toLowerCase());
}

async function queryDriverScheduleAdminPolicyRow(prisma) {
  return prisma.$queryRawUnsafe(
    `
      SELECT id, maxDailyMinutes, maxWeeklyMinutes, minRestMinutes, lockMinutesBeforeStart, allowEmergencyOverride
      FROM driver_schedule_admin_policy
      WHERE id = 1
      LIMIT 1
    `
  );
}

function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStartOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getStartOfWeek(date) {
  const start = getStartOfDay(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday first day
  start.setDate(start.getDate() + diff);
  return start;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseTimeToMinute(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

function minuteToHHmm(value) {
  const minute = clampNumber(Number(value) || 0, 0, 1439);
  const hours = Math.floor(minute / 60);
  const mins = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function reasonToMessage(reason) {
  switch (reason) {
    case 'NO_TEMPLATE':
      return 'No weekly schedule template is configured';
    case 'OUTSIDE_SCHEDULE':
      return 'Current time is outside configured work schedule';
    case 'MIN_REST_REQUIRED':
      return 'Minimum required rest period between shifts is not met';
    case 'DAILY_LIMIT':
      return 'Maximum daily work duration has been reached';
    case 'WEEKLY_LIMIT':
      return 'Maximum weekly work duration has been reached';
    case 'EMERGENCY_OVERRIDE':
      return 'Emergency override is active for today';
    case 'IN_SCHEDULE':
    default:
      return 'Driver is currently eligible according to schedule rules';
  }
}

function normalizeAdminPolicyRow(row) {
  if (!row) {
    return { ...DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY };
  }

  const maxDailyMinutes = clampNumber(
    Number(row.maxDailyMinutes) || DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.maxDailyMinutes,
    60,
    LEGAL_MAX_DAILY_MINUTES
  );
  const maxWeeklyMinutes = clampNumber(
    Number(row.maxWeeklyMinutes) || DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.maxWeeklyMinutes,
    maxDailyMinutes,
    90 * 60
  );
  const minRestMinutes = clampNumber(
    Number(row.minRestMinutes) || DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.minRestMinutes,
    0,
    24 * 60
  );
  const lockMinutesBeforeStart = clampNumber(
    Number(row.lockMinutesBeforeStart) || DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.lockMinutesBeforeStart,
    0,
    24 * 60
  );
  const allowEmergencyOverride = typeof row.allowEmergencyOverride === 'boolean'
    ? row.allowEmergencyOverride
    : Number(row.allowEmergencyOverride) === 1;

  return {
    maxDailyMinutes,
    maxWeeklyMinutes,
    minRestMinutes,
    lockMinutesBeforeStart,
    allowEmergencyOverride
  };
}

function normalizePreferenceRow(row) {
  if (!row) {
    return { ...DEFAULT_DRIVER_SCHEDULE_PREFERENCES };
  }

  const maxDailyMinutes = clampNumber(Number(row.maxDailyMinutes) || DEFAULT_DRIVER_SCHEDULE_PREFERENCES.maxDailyMinutes, 60, 14 * 60);
  const maxWeeklyMinutes = clampNumber(Number(row.maxWeeklyMinutes) || DEFAULT_DRIVER_SCHEDULE_PREFERENCES.maxWeeklyMinutes, maxDailyMinutes, 90 * 60);
  const minRestMinutes = clampNumber(Number(row.minRestMinutes) || DEFAULT_DRIVER_SCHEDULE_PREFERENCES.minRestMinutes, 0, 24 * 60);
  const lockMinutesBeforeStart = clampNumber(Number(row.lockMinutesBeforeStart) || DEFAULT_DRIVER_SCHEDULE_PREFERENCES.lockMinutesBeforeStart, 0, 24 * 60);
  const allowEmergencyOverride = typeof row.allowEmergencyOverride === 'boolean'
    ? row.allowEmergencyOverride
    : Number(row.allowEmergencyOverride) === 1;

  return {
    maxDailyMinutes,
    maxWeeklyMinutes,
    minRestMinutes,
    lockMinutesBeforeStart,
    allowEmergencyOverride
  };
}

function normalizeTemplateRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      id: Number(row.id),
      driverId: Number(row.driverId),
      dayOfWeek: Number(row.dayOfWeek),
      startMinute: Number(row.startMinute),
      endMinute: Number(row.endMinute),
      isActive: Number(row.isActive) === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))
    .filter((row) =>
      Number.isInteger(row.dayOfWeek) &&
      row.dayOfWeek >= 0 &&
      row.dayOfWeek <= 6 &&
      Number.isInteger(row.startMinute) &&
      Number.isInteger(row.endMinute) &&
      row.startMinute >= 0 &&
      row.startMinute <= 1439 &&
      row.endMinute >= 0 &&
      row.endMinute <= 1439
    )
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.endMinute - b.endMinute;
    });
}

function normalizeExceptionRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    driverId: Number(row.driverId),
    date: row.exceptionDate,
    type: String(row.type || '').toUpperCase(),
    startMinute: row.startMinute === null || row.startMinute === undefined ? null : Number(row.startMinute),
    endMinute: row.endMinute === null || row.endMinute === undefined ? null : Number(row.endMinute),
    note: row.note || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function buildTemplateMap(templateRows) {
  const map = new Map();
  for (let day = 0; day < 7; day += 1) {
    map.set(day, []);
  }

  for (const row of templateRows) {
    if (!row.isActive) continue;
    const dayRows = map.get(row.dayOfWeek) || [];
    dayRows.push({
      startMinute: row.startMinute,
      endMinute: row.endMinute
    });
    map.set(row.dayOfWeek, dayRows);
  }

  for (let day = 0; day < 7; day += 1) {
    const dayRows = map.get(day) || [];
    dayRows.sort((a, b) => (a.startMinute - b.startMinute) || (a.endMinute - b.endMinute));
    map.set(day, dayRows);
  }

  return map;
}

function dateAtMinute(baseDate, minute) {
  const date = getStartOfDay(baseDate);
  date.setMinutes(clampNumber(minute, 0, 1439));
  return date;
}

function buildIntervalsForDay(date, windows, sourceDay) {
  const intervals = [];
  for (const window of windows) {
    if (!window) continue;
    const startMinute = Number(window.startMinute);
    const endMinute = Number(window.endMinute);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) continue;
    if (startMinute === endMinute) continue;

    const start = dateAtMinute(date, startMinute);
    let end;
    if (endMinute > startMinute) {
      end = dateAtMinute(date, endMinute);
    } else {
      const nextDay = new Date(getStartOfDay(date));
      nextDay.setDate(nextDay.getDate() + 1);
      end = dateAtMinute(nextDay, endMinute);
    }

    intervals.push({
      start,
      end,
      sourceDay,
      startMinute,
      endMinute
    });
  }
  return intervals;
}

function buildCarryIntervalsFromPreviousDay(previousDate, windows) {
  const intervals = [];
  for (const window of windows) {
    if (!window) continue;
    const startMinute = Number(window.startMinute);
    const endMinute = Number(window.endMinute);
    if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute)) continue;
    if (startMinute === endMinute) continue;
    if (endMinute > startMinute) continue; // only overnight windows carry

    const start = dateAtMinute(previousDate, startMinute);
    const currentDay = new Date(getStartOfDay(previousDate));
    currentDay.setDate(currentDay.getDate() + 1);
    const end = dateAtMinute(currentDay, endMinute);
    intervals.push({
      start,
      end,
      sourceDay: previousDate.getDay(),
      startMinute,
      endMinute
    });
  }
  return intervals;
}

function isNowInsideIntervals(now, intervals) {
  return intervals.some((interval) => now >= interval.start && now < interval.end);
}

function getTodayWindows(now, templateMap, exceptionRow) {
  const todayDow = now.getDay();
  const todayWindows = templateMap.get(todayDow) || [];

  if (exceptionRow) {
    if (['OFF', 'LEAVE', 'SICK'].includes(exceptionRow.type)) {
      return [];
    }
    if (exceptionRow.type === 'CUSTOM') {
      if (Number.isInteger(exceptionRow.startMinute) && Number.isInteger(exceptionRow.endMinute) && exceptionRow.startMinute !== exceptionRow.endMinute) {
        return [{ startMinute: exceptionRow.startMinute, endMinute: exceptionRow.endMinute }];
      }
      return [];
    }
  }

  return todayWindows;
}

function buildIntervalsForEligibility(now, templateMap, exceptionRow) {
  const todayDate = getStartOfDay(now);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  if (exceptionRow) {
    if (['OFF', 'LEAVE', 'SICK'].includes(exceptionRow.type)) {
      return [];
    }

    if (exceptionRow.type === 'CUSTOM') {
      if (!Number.isInteger(exceptionRow.startMinute) || !Number.isInteger(exceptionRow.endMinute)) {
        return [];
      }
      if (exceptionRow.startMinute === exceptionRow.endMinute) {
        return [];
      }
      return buildIntervalsForDay(todayDate, [{ startMinute: exceptionRow.startMinute, endMinute: exceptionRow.endMinute }], now.getDay());
    }
  }

  const todayDow = now.getDay();
  const yesterdayDow = (todayDow + 6) % 7;
  const todayWindows = templateMap.get(todayDow) || [];
  const yesterdayWindows = templateMap.get(yesterdayDow) || [];

  return [
    ...buildCarryIntervalsFromPreviousDay(yesterdayDate, yesterdayWindows),
    ...buildIntervalsForDay(todayDate, todayWindows, todayDow)
  ];
}

function getOverlapMinutes(start, end, rangeStart, rangeEnd) {
  const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());
  if (overlapEnd <= overlapStart) return 0;
  return Math.floor((overlapEnd - overlapStart) / 60000);
}

async function getWorkedMinutesSnapshot(prisma, driverId, now) {
  const startOfDay = getStartOfDay(now);
  const startOfWeek = getStartOfWeek(now);

  const shifts = await prisma.driversvagt.findMany({
    where: {
      drId: Number(driverId),
      OR: [
        { endVagt: null },
        { endVagt: { gte: startOfWeek } }
      ]
    },
    select: {
      startVagt: true,
      endVagt: true
    },
    orderBy: {
      date: 'desc'
    }
  });

  let dailyWorkedMinutes = 0;
  let weeklyWorkedMinutes = 0;
  let hasActiveShift = false;

  for (const shift of shifts) {
    if (!shift.startVagt) continue;
    const start = new Date(shift.startVagt);
    const end = shift.endVagt ? new Date(shift.endVagt) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end <= start) continue;
    if (!shift.endVagt) {
      hasActiveShift = true;
    }

    weeklyWorkedMinutes += getOverlapMinutes(start, end, startOfWeek, now);
    dailyWorkedMinutes += getOverlapMinutes(start, end, startOfDay, now);
  }

  let restSinceLastShiftMinutes = Number.POSITIVE_INFINITY;
  if (!hasActiveShift) {
    const lastEndedShift = await prisma.driversvagt.findFirst({
      where: {
        drId: Number(driverId),
        endVagt: { not: null }
      },
      select: {
        endVagt: true
      },
      orderBy: {
        endVagt: 'desc'
      }
    });

    if (lastEndedShift?.endVagt) {
      const endTime = new Date(lastEndedShift.endVagt).getTime();
      if (!Number.isNaN(endTime)) {
        restSinceLastShiftMinutes = Math.max(0, Math.floor((now.getTime() - endTime) / 60000));
      }
    }
  }

  return {
    dailyWorkedMinutes,
    weeklyWorkedMinutes,
    restSinceLastShiftMinutes,
    hasActiveShift
  };
}

function getCacheKey(driverId, strict, now) {
  const minuteBucket = Math.floor(now.getTime() / 60000);
  return `${Number(driverId)}:${strict ? 'strict' : 'light'}:${minuteBucket}`;
}

function getCachedEligibility(driverId, strict, now) {
  const key = getCacheKey(driverId, strict, now);
  const cached = eligibilityCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    eligibilityCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedEligibility(driverId, strict, now, value) {
  const key = getCacheKey(driverId, strict, now);
  const ttl = strict ? ELIGIBILITY_CACHE_MS_STRICT : ELIGIBILITY_CACHE_MS_LIGHT;
  eligibilityCache.set(key, {
    value,
    expiresAt: Date.now() + ttl
  });
}

function invalidateDriverScheduleCache(driverId) {
  const prefix = `${Number(driverId)}:`;
  for (const key of eligibilityCache.keys()) {
    if (key.startsWith(prefix)) {
      eligibilityCache.delete(key);
    }
  }
}

function invalidateAllDriverScheduleCache() {
  eligibilityCache.clear();
}

async function ensureDriverScheduleTables(prisma, options = {}) {
  const force = options.force === true;

  if (!force && global.__driverScheduleTablesReady === DRIVER_SCHEDULE_SCHEMA_VERSION) {
    return;
  }

  if (!force && ensureDriverScheduleTablesPromise) {
    return ensureDriverScheduleTablesPromise;
  }

  ensureDriverScheduleTablesPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS driver_work_schedule_template (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driverId INT NOT NULL,
        dayOfWeek TINYINT NOT NULL,
        startMinute SMALLINT NOT NULL,
        endMinute SMALLINT NOT NULL,
        isActive TINYINT(1) NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_driver_day (driverId, dayOfWeek),
        KEY idx_driver_active (driverId, isActive),
        UNIQUE KEY uniq_driver_day_window (driverId, dayOfWeek, startMinute, endMinute)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS driver_work_schedule_exception (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driverId INT NOT NULL,
        exceptionDate DATE NOT NULL,
        type VARCHAR(24) NOT NULL,
        startMinute SMALLINT NULL,
        endMinute SMALLINT NULL,
        note VARCHAR(255) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_driver_exception_date (driverId, exceptionDate),
        UNIQUE KEY uniq_driver_exception_date (driverId, exceptionDate)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS driver_schedule_preferences (
        driverId INT PRIMARY KEY,
        maxDailyMinutes SMALLINT NOT NULL DEFAULT 600,
        maxWeeklyMinutes SMALLINT NOT NULL DEFAULT 3360,
        minRestMinutes SMALLINT NOT NULL DEFAULT 660,
        lockMinutesBeforeStart SMALLINT NOT NULL DEFAULT 30,
        allowEmergencyOverride TINYINT(1) NOT NULL DEFAULT 1,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS driver_schedule_admin_policy (
        id TINYINT NOT NULL PRIMARY KEY,
        maxDailyMinutes SMALLINT NOT NULL DEFAULT 660,
        maxWeeklyMinutes SMALLINT NOT NULL DEFAULT 3360,
        minRestMinutes SMALLINT NOT NULL DEFAULT 660,
        lockMinutesBeforeStart SMALLINT NOT NULL DEFAULT 30,
        allowEmergencyOverride TINYINT(1) NOT NULL DEFAULT 1,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await prisma.$executeRawUnsafe(
      `
        INSERT IGNORE INTO driver_schedule_admin_policy
        (id, maxDailyMinutes, maxWeeklyMinutes, minRestMinutes, lockMinutesBeforeStart, allowEmergencyOverride)
        VALUES (1, ?, ?, ?, ?, ?)
      `,
      DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.maxDailyMinutes,
      DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.maxWeeklyMinutes,
      DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.minRestMinutes,
      DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.lockMinutesBeforeStart,
      DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY.allowEmergencyOverride ? 1 : 0
    );

    global.__driverScheduleTablesReady = DRIVER_SCHEDULE_SCHEMA_VERSION;
  })();

  try {
    await ensureDriverScheduleTablesPromise;
  } finally {
    ensureDriverScheduleTablesPromise = null;
  }
}

async function getDriverScheduleAdminPolicy(prisma) {
  await ensureDriverScheduleTables(prisma);

  let rows;
  try {
    rows = await queryDriverScheduleAdminPolicyRow(prisma);
  } catch (error) {
    if (!isMissingTableError(error, 'driver_schedule_admin_policy')) {
      throw error;
    }

    global.__driverScheduleTablesReady = 0;
    await ensureDriverScheduleTables(prisma, { force: true });
    rows = await queryDriverScheduleAdminPolicyRow(prisma);
  }

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return normalizeAdminPolicyRow(row);
}

async function getDriverScheduleTemplate(prisma, driverId) {
  await ensureDriverScheduleTables(prisma);
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id, driverId, dayOfWeek, startMinute, endMinute, isActive, createdAt, updatedAt
      FROM driver_work_schedule_template
      WHERE driverId = ?
      ORDER BY dayOfWeek ASC, startMinute ASC
    `,
    Number(driverId)
  );

  return normalizeTemplateRows(rows);
}

async function getDriverSchedulePreferences(prisma, driverId) {
  await ensureDriverScheduleTables(prisma);
  const adminPolicy = await getDriverScheduleAdminPolicy(prisma);

  return {
    maxDailyMinutes: clampNumber(adminPolicy.maxDailyMinutes, 60, LEGAL_MAX_DAILY_MINUTES),
    maxWeeklyMinutes: clampNumber(adminPolicy.maxWeeklyMinutes, adminPolicy.maxDailyMinutes, 90 * 60),
    minRestMinutes: clampNumber(adminPolicy.minRestMinutes, 0, 24 * 60),
    lockMinutesBeforeStart: clampNumber(adminPolicy.lockMinutesBeforeStart, 0, 24 * 60),
    allowEmergencyOverride: Boolean(adminPolicy.allowEmergencyOverride)
  };
}

async function getDriverScheduleExceptions(prisma, driverId, options = {}) {
  await ensureDriverScheduleTables(prisma);

  const fromDate = options.fromDate || '1970-01-01';
  const toDate = options.toDate || '2999-12-31';

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id, driverId, exceptionDate, type, startMinute, endMinute, note, createdAt, updatedAt
      FROM driver_work_schedule_exception
      WHERE driverId = ?
        AND exceptionDate >= ?
        AND exceptionDate <= ?
      ORDER BY exceptionDate ASC
    `,
    Number(driverId),
    fromDate,
    toDate
  );

  return Array.isArray(rows) ? rows.map(normalizeExceptionRow).filter(Boolean) : [];
}

async function getExceptionForDate(prisma, driverId, dateString) {
  await ensureDriverScheduleTables(prisma);

  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT id, driverId, exceptionDate, type, startMinute, endMinute, note, createdAt, updatedAt
      FROM driver_work_schedule_exception
      WHERE driverId = ?
        AND exceptionDate = ?
      LIMIT 1
    `,
    Number(driverId),
    dateString
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return normalizeExceptionRow(rows[0]);
}

async function getDriverScheduleEligibility(prisma, driverId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const strict = options.strict === true;
  const allowEmergencyOverride = options.allowEmergencyOverride !== false;
  const rideStart = options.rideStart instanceof Date ? options.rideStart : null;
  const rideEnd = options.rideEnd instanceof Date ? options.rideEnd : null;
  const rideDurationMin = Number(options.rideDurationMin) || 0;

  const cached = getCachedEligibility(driverId, strict, now);
  if (cached) {
    return cached;
  }

  await ensureDriverScheduleTables(prisma);

  const todayDateText = toLocalDateString(now);
  const [templateRows, preferences, todayException] = await Promise.all([
    getDriverScheduleTemplate(prisma, driverId),
    getDriverSchedulePreferences(prisma, driverId),
    getExceptionForDate(prisma, driverId, todayDateText)
  ]);

  const templateMap = buildTemplateMap(templateRows);
  const todayWindows = getTodayWindows(now, templateMap, todayException);

  const baseResult = {
    driverId: Number(driverId),
    checkedAt: now.toISOString(),
    preferences,
    todayWindows: todayWindows.map((window) => ({
      startMinute: window.startMinute,
      endMinute: window.endMinute,
      start: minuteToHHmm(window.startMinute),
      end: minuteToHHmm(window.endMinute)
    })),
    activeException: todayException
      ? {
          id: todayException.id,
          date: todayException.date,
          type: todayException.type,
          startMinute: todayException.startMinute,
          endMinute: todayException.endMinute,
          start: todayException.startMinute === null ? null : minuteToHHmm(todayException.startMinute),
          end: todayException.endMinute === null ? null : minuteToHHmm(todayException.endMinute),
          note: todayException.note
        }
      : null
  };

  if (todayException?.type === 'EMERGENCY' && allowEmergencyOverride && preferences.allowEmergencyOverride) {
    const result = {
      ...baseResult,
      eligible: true,
      reason: 'EMERGENCY_OVERRIDE',
      reasonMessage: reasonToMessage('EMERGENCY_OVERRIDE'),
      metrics: null
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  if (!templateRows.some((row) => row.isActive)) {
    if (!strict) {
      const result = {
        ...baseResult,
        eligible: true,
        reason: 'NO_TEMPLATE',
        reasonMessage: 'No schedule template configured — driver is not restricted by shift windows',
        metrics: null
      };
      setCachedEligibility(driverId, strict, now, result);
      return result;
    }
    const metrics = await getWorkedMinutesSnapshot(prisma, driverId, now);
    const projectedDailyMinutes = metrics.dailyWorkedMinutes + rideDurationMin;
    if (projectedDailyMinutes > LEGAL_MAX_DAILY_MINUTES) {
      const result = {
        ...baseResult,
        eligible: false,
        reason: 'DAILY_LIMIT',
        reasonMessage: reasonToMessage('DAILY_LIMIT'),
        metrics: {
          ...metrics,
          dailyRemainingMinutes: 0,
          projectedDailyMinutes,
          maxDailyMinutes: LEGAL_MAX_DAILY_MINUTES,
          weeklyRemainingMinutes: 0
        }
      };
      setCachedEligibility(driverId, strict, now, result);
      return result;
    }
    const result = {
      ...baseResult,
      eligible: true,
      reason: 'NO_TEMPLATE',
      reasonMessage: 'No schedule template configured — only 11-hour legal limit applies',
      metrics: {
        ...metrics,
        dailyRemainingMinutes: Math.max(0, LEGAL_MAX_DAILY_MINUTES - metrics.dailyWorkedMinutes),
        weeklyRemainingMinutes: null,
        maxDailyMinutes: LEGAL_MAX_DAILY_MINUTES,
        projectedDailyMinutes
      }
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  const intervals = buildIntervalsForEligibility(now, templateMap, todayException);

  let insideSchedule = isNowInsideIntervals(now, intervals);
  let rideFitsInSchedule = false;

  if (rideStart && rideEnd) {
    const rideDateText = toLocalDateString(rideStart);
    const rideException = rideDateText !== todayDateText
      ? await getExceptionForDate(prisma, driverId, rideDateText)
      : todayException;
    const rideIntervals = buildIntervalsForEligibility(rideStart, templateMap, rideException);
    rideFitsInSchedule = rideIntervals.some((interval) =>
      rideStart >= interval.start && rideEnd <= interval.end
    );
  }

  if (!insideSchedule && !rideFitsInSchedule) {
    const result = {
      ...baseResult,
      eligible: false,
      reason: 'OUTSIDE_SCHEDULE',
      reasonMessage: reasonToMessage('OUTSIDE_SCHEDULE'),
      metrics: null
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  if (!strict) {
    const result = {
      ...baseResult,
      eligible: true,
      reason: 'IN_SCHEDULE',
      reasonMessage: reasonToMessage('IN_SCHEDULE'),
      metrics: null
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  const metrics = await getWorkedMinutesSnapshot(prisma, driverId, now);

  const projectedDailyMinutes = metrics.dailyWorkedMinutes + rideDurationMin;

  if (projectedDailyMinutes > preferences.maxDailyMinutes) {
    const dailyRemaining = Math.max(0, preferences.maxDailyMinutes - metrics.dailyWorkedMinutes);
    const result = {
      ...baseResult,
      eligible: false,
      reason: 'DAILY_LIMIT',
      reasonMessage: reasonToMessage('DAILY_LIMIT'),
      metrics: {
        ...metrics,
        dailyRemainingMinutes: dailyRemaining,
        dailyWorkedMinutes: metrics.dailyWorkedMinutes,
        projectedDailyMinutes,
        maxDailyMinutes: preferences.maxDailyMinutes,
        weeklyRemainingMinutes: Math.max(0, preferences.maxWeeklyMinutes - metrics.weeklyWorkedMinutes)
      }
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  if (metrics.weeklyWorkedMinutes >= preferences.maxWeeklyMinutes) {
    const result = {
      ...baseResult,
      eligible: false,
      reason: 'WEEKLY_LIMIT',
      reasonMessage: reasonToMessage('WEEKLY_LIMIT'),
      metrics: {
        ...metrics,
        dailyRemainingMinutes: Math.max(0, preferences.maxDailyMinutes - metrics.dailyWorkedMinutes),
        weeklyRemainingMinutes: 0
      }
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  if (Number.isFinite(metrics.restSinceLastShiftMinutes) && metrics.restSinceLastShiftMinutes < preferences.minRestMinutes) {
    const result = {
      ...baseResult,
      eligible: false,
      reason: 'MIN_REST_REQUIRED',
      reasonMessage: reasonToMessage('MIN_REST_REQUIRED'),
      metrics: {
        ...metrics,
        dailyRemainingMinutes: Math.max(0, preferences.maxDailyMinutes - metrics.dailyWorkedMinutes),
        weeklyRemainingMinutes: Math.max(0, preferences.maxWeeklyMinutes - metrics.weeklyWorkedMinutes),
        restRemainingMinutes: Math.max(0, preferences.minRestMinutes - metrics.restSinceLastShiftMinutes)
      }
    };
    setCachedEligibility(driverId, strict, now, result);
    return result;
  }

  const result = {
    ...baseResult,
    eligible: true,
    reason: 'IN_SCHEDULE',
    reasonMessage: reasonToMessage('IN_SCHEDULE'),
    metrics: {
      ...metrics,
      dailyRemainingMinutes: Math.max(0, preferences.maxDailyMinutes - metrics.dailyWorkedMinutes),
      weeklyRemainingMinutes: Math.max(0, preferences.maxWeeklyMinutes - metrics.weeklyWorkedMinutes),
      restRemainingMinutes: 0
    }
  };

  setCachedEligibility(driverId, strict, now, result);
  return result;
}

async function canDriverReceiveRide(prisma, driverId, options = {}) {
  const strict = options.strict === true;
  return getDriverScheduleEligibility(prisma, driverId, {
    ...options,
    strict
  });
}

async function upsertDriverScheduleTemplate(prisma, driverId, entries) {
  await ensureDriverScheduleTables(prisma);

  const normalizedEntries = Array.isArray(entries)
    ? entries
        .map((entry) => ({
          dayOfWeek: Number(entry.dayOfWeek),
          startMinute: Number(entry.startMinute),
          endMinute: Number(entry.endMinute),
          isActive: entry.isActive !== false
        }))
        .filter((entry) =>
          Number.isInteger(entry.dayOfWeek) &&
          entry.dayOfWeek >= 0 &&
          entry.dayOfWeek <= 6 &&
          Number.isInteger(entry.startMinute) &&
          Number.isInteger(entry.endMinute) &&
          entry.startMinute >= 0 &&
          entry.startMinute <= 1439 &&
          entry.endMinute >= 0 &&
          entry.endMinute <= 1439 &&
          entry.startMinute !== entry.endMinute
        )
    : [];

  await prisma.$executeRawUnsafe(
    `DELETE FROM driver_work_schedule_template WHERE driverId = ?`,
    Number(driverId)
  );

  for (const entry of normalizedEntries) {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO driver_work_schedule_template (driverId, dayOfWeek, startMinute, endMinute, isActive)
        VALUES (?, ?, ?, ?, ?)
      `,
      Number(driverId),
      entry.dayOfWeek,
      entry.startMinute,
      entry.endMinute,
      entry.isActive ? 1 : 0
    );
  }

  invalidateDriverScheduleCache(driverId);

  return getDriverScheduleTemplate(prisma, driverId);
}

async function upsertDriverSchedulePreferences(prisma, driverId, patch = {}) {
  await ensureDriverScheduleTables(prisma);

  const existing = await getDriverSchedulePreferences(prisma, driverId);
  const merged = {
    ...existing,
    ...patch
  };

  const normalized = normalizePreferenceRow(merged);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO driver_schedule_preferences
      (driverId, maxDailyMinutes, maxWeeklyMinutes, minRestMinutes, lockMinutesBeforeStart, allowEmergencyOverride)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        maxDailyMinutes = VALUES(maxDailyMinutes),
        maxWeeklyMinutes = VALUES(maxWeeklyMinutes),
        minRestMinutes = VALUES(minRestMinutes),
        lockMinutesBeforeStart = VALUES(lockMinutesBeforeStart),
        allowEmergencyOverride = VALUES(allowEmergencyOverride),
        updatedAt = CURRENT_TIMESTAMP
    `,
    Number(driverId),
    normalized.maxDailyMinutes,
    normalized.maxWeeklyMinutes,
    normalized.minRestMinutes,
    normalized.lockMinutesBeforeStart,
    normalized.allowEmergencyOverride ? 1 : 0
  );

  invalidateDriverScheduleCache(driverId);

  return normalized;
}

async function upsertDriverScheduleAdminPolicy(prisma, patch = {}) {
  await ensureDriverScheduleTables(prisma);

  const existing = await getDriverScheduleAdminPolicy(prisma);
  const merged = {
    ...existing,
    ...patch
  };

  const normalized = normalizeAdminPolicyRow(merged);

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO driver_schedule_admin_policy
      (id, maxDailyMinutes, maxWeeklyMinutes, minRestMinutes, lockMinutesBeforeStart, allowEmergencyOverride)
      VALUES (1, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        maxDailyMinutes = VALUES(maxDailyMinutes),
        maxWeeklyMinutes = VALUES(maxWeeklyMinutes),
        minRestMinutes = VALUES(minRestMinutes),
        lockMinutesBeforeStart = VALUES(lockMinutesBeforeStart),
        allowEmergencyOverride = VALUES(allowEmergencyOverride),
        updatedAt = CURRENT_TIMESTAMP
    `,
    normalized.maxDailyMinutes,
    normalized.maxWeeklyMinutes,
    normalized.minRestMinutes,
    normalized.lockMinutesBeforeStart,
    normalized.allowEmergencyOverride ? 1 : 0
  );

  invalidateAllDriverScheduleCache();

  return normalized;
}

async function upsertDriverScheduleException(prisma, driverId, payload) {
  await ensureDriverScheduleTables(prisma);

  const date = typeof payload.date === 'string' ? payload.date : '';
  const type = typeof payload.type === 'string' ? payload.type.toUpperCase() : 'OFF';
  const note = typeof payload.note === 'string' ? payload.note.slice(0, 255) : null;

  const requiresWindow = type === 'CUSTOM';
  const startMinute = requiresWindow ? Number(payload.startMinute) : null;
  const endMinute = requiresWindow ? Number(payload.endMinute) : null;

  if (requiresWindow) {
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute === endMinute) {
      throw new Error('CUSTOM exception requires valid startMinute and endMinute');
    }
  }

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO driver_work_schedule_exception
      (driverId, exceptionDate, type, startMinute, endMinute, note)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        type = VALUES(type),
        startMinute = VALUES(startMinute),
        endMinute = VALUES(endMinute),
        note = VALUES(note),
        updatedAt = CURRENT_TIMESTAMP
    `,
    Number(driverId),
    date,
    type,
    startMinute,
    endMinute,
    note
  );

  invalidateDriverScheduleCache(driverId);
}

async function deleteDriverScheduleException(prisma, driverId, date) {
  await ensureDriverScheduleTables(prisma);

  await prisma.$executeRawUnsafe(
    `DELETE FROM driver_work_schedule_exception WHERE driverId = ? AND exceptionDate = ?`,
    Number(driverId),
    date
  );

  invalidateDriverScheduleCache(driverId);
}

function mapMysqlDayToJsDay(mysqlDay) {
  const day = Number(mysqlDay);
  if (!Number.isInteger(day)) return 0;
  // MySQL: 1=Sunday ... 7=Saturday
  return (day + 6) % 7;
}

function getDefaultSuggestedWindow(dayOfWeek) {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    return { startMinute: 8 * 60, endMinute: 16 * 60 };
  }
  return { startMinute: 6 * 60, endMinute: 14 * 60 };
}

function buildSuggestionsFromHeatmap(heatmap) {
  const suggestions = [];
  const bestScores = [];

  for (let day = 0; day < 7; day += 1) {
    const dayCounts = heatmap[day] || new Array(24).fill(0);
    let best = { score: 0, startHour: 0, length: 4 };

    for (const length of [3, 4, 5]) {
      for (let startHour = 0; startHour <= 24 - length; startHour += 1) {
        let score = 0;
        for (let hour = startHour; hour < startHour + length; hour += 1) {
          score += Number(dayCounts[hour] || 0);
        }

        if (
          score > best.score ||
          (score === best.score && score > 0 && length > best.length)
        ) {
          best = { score, startHour, length };
        }
      }
    }

    if (best.score <= 0) {
      const fallback = getDefaultSuggestedWindow(day);
      suggestions.push({
        dayOfWeek: day,
        dayName: DAY_NAMES[day],
        windows: [{
          startMinute: fallback.startMinute,
          endMinute: fallback.endMinute,
          start: minuteToHHmm(fallback.startMinute),
          end: minuteToHHmm(fallback.endMinute),
          confidence: 0
        }]
      });
      bestScores.push(0);
      continue;
    }

    const startMinute = best.startHour * 60;
    const endMinute = (best.startHour + best.length) * 60;

    suggestions.push({
      dayOfWeek: day,
      dayName: DAY_NAMES[day],
      windows: [{
        startMinute,
        endMinute,
        start: minuteToHHmm(startMinute),
        end: minuteToHHmm(endMinute),
        confidence: best.score
      }]
    });
    bestScores.push(best.score);
  }

  const maxScore = bestScores.reduce((max, value) => Math.max(max, value), 0);
  if (maxScore > 0) {
    for (const suggestion of suggestions) {
      suggestion.windows = suggestion.windows.map((window) => ({
        ...window,
        confidence: window.confidence > 0
          ? Math.round((window.confidence / maxScore) * 100)
          : 0
      }));
    }
  }

  return suggestions;
}

async function getDriverScheduleSuggestions(prisma, driverId, options = {}) {
  await ensureDriverScheduleTables(prisma);

  const now = options.now instanceof Date ? options.now : new Date();
  const daysBack = clampNumber(Number(options.daysBack) || 42, 7, 120);

  const driverRows = await prisma.$queryRawUnsafe(
    `
      SELECT DAYOFWEEK(pickupTime) AS dayNumber, HOUR(pickupTime) AS hourSlot, COUNT(*) AS rideCount
      FROM Ride
      WHERE status = 'COMPLETED'
        AND driverId = ?
        AND pickupTime >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
      GROUP BY DAYOFWEEK(pickupTime), HOUR(pickupTime)
    `,
    Number(driverId),
    daysBack
  );

  let rows = Array.isArray(driverRows) ? driverRows : [];
  let source = 'driver';

  const sampleCount = rows.reduce((sum, row) => sum + Number(row.rideCount || 0), 0);
  if (sampleCount < 10) {
    const globalRows = await prisma.$queryRawUnsafe(
      `
        SELECT DAYOFWEEK(pickupTime) AS dayNumber, HOUR(pickupTime) AS hourSlot, COUNT(*) AS rideCount
        FROM Ride
        WHERE status = 'COMPLETED'
          AND pickupTime >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
        GROUP BY DAYOFWEEK(pickupTime), HOUR(pickupTime)
      `,
      daysBack
    );

    rows = Array.isArray(globalRows) ? globalRows : [];
    source = 'global';
  }

  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const row of rows) {
    const day = mapMysqlDayToJsDay(row.dayNumber);
    const hour = Number(row.hourSlot);
    const count = Number(row.rideCount || 0);
    if (day < 0 || day > 6) continue;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    heatmap[day][hour] += count;
  }

  return {
    source,
    generatedAt: now.toISOString(),
    daysBack,
    suggestions: buildSuggestionsFromHeatmap(heatmap)
  };
}

async function isTemplateEditLocked(prisma, driverId, now = new Date()) {
  await ensureDriverScheduleTables(prisma);

  const today = toLocalDateString(now);
  const [templateRows, preferences, exception] = await Promise.all([
    getDriverScheduleTemplate(prisma, driverId),
    getDriverSchedulePreferences(prisma, driverId),
    getExceptionForDate(prisma, driverId, today)
  ]);

  const map = buildTemplateMap(templateRows);
  const intervals = buildIntervalsForEligibility(now, map, exception);

  for (const interval of intervals) {
    if (now >= interval.start && now < interval.end) {
      return {
        locked: true,
        reason: 'INSIDE_ACTIVE_WINDOW',
        reasonMessage: 'Cannot edit schedule while current work window is active',
        lockMinutesBeforeStart: preferences.lockMinutesBeforeStart
      };
    }
  }

  const upcomingIntervals = intervals
    .filter((interval) => interval.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (upcomingIntervals.length > 0) {
    const minutesUntilStart = Math.floor((upcomingIntervals[0].start.getTime() - now.getTime()) / 60000);
    if (minutesUntilStart <= preferences.lockMinutesBeforeStart) {
      return {
        locked: true,
        reason: 'LOCK_WINDOW_BEFORE_START',
        reasonMessage: 'Cannot edit schedule shortly before work window start time',
        minutesUntilStart,
        lockMinutesBeforeStart: preferences.lockMinutesBeforeStart,
        nextWindowStart: upcomingIntervals[0].start.toISOString()
      };
    }
  }

  return {
    locked: false,
    reason: 'UNLOCKED',
    reasonMessage: 'Schedule can be edited now',
    lockMinutesBeforeStart: preferences.lockMinutesBeforeStart
  };
}

async function getDriverScheduleSnapshot(prisma, driverId, now = new Date()) {
  return getDriverScheduleEligibility(prisma, driverId, {
    now,
    strict: true,
    allowEmergencyOverride: true
  });
}

module.exports = {
  DAY_NAMES,
  LEGAL_MAX_DAILY_MINUTES,
  DEFAULT_DRIVER_SCHEDULE_PREFERENCES,
  DEFAULT_DRIVER_SCHEDULE_ADMIN_POLICY,
  ensureDriverScheduleTables,
  parseTimeToMinute,
  minuteToHHmm,
  getDriverScheduleAdminPolicy,
  getDriverScheduleTemplate,
  getDriverSchedulePreferences,
  getDriverScheduleExceptions,
  getDriverScheduleEligibility,
  getDriverScheduleSnapshot,
  canDriverReceiveRide,
  upsertDriverScheduleTemplate,
  upsertDriverSchedulePreferences,
  upsertDriverScheduleException,
  deleteDriverScheduleException,
  getDriverScheduleSuggestions,
  isTemplateEditLocked,
  upsertDriverScheduleAdminPolicy,
  invalidateDriverScheduleCache,
  invalidateAllDriverScheduleCache,
  toLocalDateString
};

