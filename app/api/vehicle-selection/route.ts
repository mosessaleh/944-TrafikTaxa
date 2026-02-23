import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateDistance, getDistanceAndDuration } from '@/lib/distance';
import { computePrice } from '@/lib/price';
import Holidays from 'date-holidays';

interface VehicleSelectionRequest {
  pickupLat: number;
  pickupLon: number;
  vehicleTypeId: number;
  maxVehicles?: number;
  dropoffLat?: number;
  dropoffLon?: number;
  excludedDriverIds?: number[];
  // للحجوزات المجدولة: تمرير موعد الالتقاط لاقتراح سائق متسلسل يوضع في driverQueue
  scheduledPickupTime?: string;
}

interface RawDriver {
  driverId: number;
  location: { lat: number; lng: number };
  socketId?: string | null;
  vehicleTypeId: number | null;
}

interface CandidateDriver {
  driverId: number;
  vehicleId: number;
  vehicleTypeId: number;
  location: { lat: number; lng: number };
  distanceKm: number;
  etaMinutes: number;
  income: number;
  incomePerHour: number;
  hoursWorked: number;
  rating: number;
  ratingScore: number;
  completedRides: number;
  experienceScore: number;
}

const SPEED_KMH = 30;
const SHORT_WINDOW_MINUTES = 5;
const MID_WINDOW_MINUTES = 10;
const LONG_WINDOW_MINUTES = 20;
const DISTANCE_MATRIX_LIMIT = 6;
// الحد الأقصى المسموح لزمن الانتقال بين نهاية رحلة مجدولة وبداية أخرى ليتم اعتباره مرشح تتابع
const CHAIN_MAX_TRAVEL_MINUTES = 25;
const CHAIN_LOOKBACK_HOURS = 6;
const CHAIN_LOOKAHEAD_HOURS = 6;

const VEHICLE_TYPE_MAP: Record<string, number> = {
  SEDAN5: 1,
  SEVEN_NO_BAG: 2,
  VAN: 3,
  LIMO: 4
};

const PRIORITY_TYPES: Record<number, number[]> = {
  1: [1, 2, 3, 4], // Sedan: sedan -> 7-seat -> van -> limo
  2: [2, 3], // 7-seat: 7-seat -> van
  3: [3], // Van: van only
  4: [4] // Limo: limo only
};

const ALLOWED_TYPES: Record<number, number[]> = {
  1: [1, 2, 3, 4],
  2: [2, 3],
  3: [3],
  4: [4]
};

function estimateEtaMinutes(distanceKm: number) {
  return Math.ceil((distanceKm / SPEED_KMH) * 60);
}

function computeRideEndTime(pickupTime: Date | null, durationMin?: number | null, distanceKm?: number | null) {
  if (!pickupTime) return null;
  const duration = Number.isFinite(durationMin) && durationMin !== null
    ? Number(durationMin)
    : (Number.isFinite(distanceKm) && distanceKm !== null ? Math.max(1, Math.ceil(Number(distanceKm) * 2)) : 30);
  return new Date(pickupTime.getTime() + duration * 60000);
}

function isHoliday(at: Date) {
  const dayOfWeek = at.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const hd = new Holidays('DK');
  const holidays = hd.getHolidays(at.getFullYear());
  const ymd = at.toISOString().slice(0, 10);
  if (holidays.some((h: any) => h.date.slice(0, 10) === ymd)) return true;

  const list = (process.env.HOLIDAYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(ymd);
}

function getHourlyRateThreshold(vehicleTypeId: number, at: Date) {
  const hour = at.getHours();
  const holiday = isHoliday(at);
  const night = hour < 6 || hour >= 18;

  const thresholds = {
    1: { day: 400, night: 500, holiday: 600 },
    2: { day: 450, night: 550, holiday: 650 },
    3: { day: 500, night: 600, holiday: 750 },
    4: { day: 800, night: 900, holiday: 1100 }
  } as Record<number, { day: number; night: number; holiday: number }>;

  const vehicleThreshold = thresholds[vehicleTypeId] || thresholds[1];
  if (holiday) return vehicleThreshold.holiday;
  if (night) return vehicleThreshold.night;
  return vehicleThreshold.day;
}

function getPriorityTypes(vehicleTypeId: number) {
  return PRIORITY_TYPES[vehicleTypeId] || [vehicleTypeId];
}

function getAllowedTypes(vehicleTypeId: number) {
  return ALLOWED_TYPES[vehicleTypeId] || [vehicleTypeId];
}

function sortByScore(candidates: CandidateDriver[]) {
  return [...candidates].sort((a, b) => {
    if (a.incomePerHour !== b.incomePerHour) return a.incomePerHour - b.incomePerHour;
    if (a.income !== b.income) return a.income - b.income;
    if (a.ratingScore !== b.ratingScore) return b.ratingScore - a.ratingScore;
    if (a.experienceScore !== b.experienceScore) return b.experienceScore - a.experienceScore;
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    return a.distanceKm - b.distanceKm;
  });
}

function sortByClosest(candidates: CandidateDriver[]) {
  return [...candidates].sort((a, b) => {
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    return a.distanceKm - b.distanceKm;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: VehicleSelectionRequest = await request.json();
    const {
      pickupLat,
      pickupLon,
      vehicleTypeId,
      maxVehicles = 3,
      dropoffLat,
      dropoffLon,
      excludedDriverIds = [],
      scheduledPickupTime
    } = body;

    if (pickupLat === undefined || pickupLon === undefined || !vehicleTypeId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required parameters: pickupLat, pickupLon, vehicleTypeId'
        },
        { status: 400 }
      );
    }

    const excludedSet = new Set((excludedDriverIds || []).map((id) => Number(id)));
    const connectedDrivers = (global as any).connectedDrivers || new Map();
    const useDatabaseFallback = false;

    let availableDrivers: RawDriver[] = (Array.from(connectedDrivers.entries()) as [string, any][])
      .filter(([driverId, driverData]) =>
        driverData?.location &&
        typeof driverData.location.lat === 'number' &&
        typeof driverData.location.lng === 'number' &&
        !excludedSet.has(Number(driverId))
      )
      .map(([driverId, driverData]) => ({
        driverId: Number(driverId),
        location: driverData.location,
        socketId: driverData.socketId || null,
        vehicleTypeId: Number(driverData.vehicleTypeId || 0) || null
      }));

    if (availableDrivers.length === 0) {
      return NextResponse.json({
        ok: true,
        vehicles: [],
        totalAvailable: 0,
        selectedCount: 0,
        windowUsed: 'none',
        selectionMode: 'none',
        useDatabaseFallback
      });
    }

    const driverIds = availableDrivers.map((d) => d.driverId);
    const now = new Date();

    const driverRecords: any[] = await (prisma as any).comDriver.findMany({
      where: {
        id: { in: driverIds },
        isActive: true,
        car: { not: null },
        currentRideId: null,
        isBusy: false,
        OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }]
      },
      select: {
        id: true,
        car: true,
        rating: true
      }
    });

    if (driverRecords.length === 0) {
      return NextResponse.json({
        ok: true,
        vehicles: [],
        totalAvailable: 0,
        selectedCount: 0,
        windowUsed: 'none',
        selectionMode: 'none',
        useDatabaseFallback
      });
    }

    const driverRecordMap = new Map(driverRecords.map((d) => [d.id, d]));
    const carPlates = driverRecords.map((d) => d.car).filter((car: any): car is string => car !== null);

    const vehicles: any[] = await (prisma as any).comVehicles.findMany({
      where: {
        regNumber: { in: carPlates }
      },
      select: {
        id: true,
        regNumber: true,
        vehicleType: true
      }
    });

    const vehicleMap = new Map(vehicles.map((v: any) => [v.regNumber, v]));

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);

    const shifts: any[] = await (prisma as any).driversvagt.findMany({
      where: {
        drId: { in: driverIds },
        date: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      select: {
        drId: true,
        startVagt: true,
        endVagt: true,
        workTime: true
      }
    });

    const hoursMap = new Map<number, number>();
    for (const shift of shifts) {
      const workTimeRaw = shift.workTime;
      const workTime = workTimeRaw ? Number(workTimeRaw) : 0;
      let hours = 0;
      if (!Number.isNaN(workTime) && workTime > 0) {
        hours = workTime;
      } else if (shift.startVagt) {
        const start = new Date(shift.startVagt).getTime();
        const end = shift.endVagt ? new Date(shift.endVagt).getTime() : now.getTime();
        hours = Math.max((end - start) / (1000 * 60 * 60), 0);
      }

      if (hours > 0) {
        hoursMap.set(shift.drId, (hoursMap.get(shift.drId) || 0) + hours);
      }
    }

    const incomeGroups: any[] = await (prisma as any).ride.groupBy({
      by: ['driverId'],
      where: {
        driverId: { in: driverIds },
        status: 'COMPLETED',
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      _sum: {
        price: true
      },
      _count: {
        _all: true
      }
    });

    const incomeMap = new Map(incomeGroups.map((g: any) => [g.driverId, Number(g._sum.price || 0)]));
    const completedMap = new Map(incomeGroups.map((g: any) => [g.driverId, Number(g._count._all || 0)]));

    const candidates: CandidateDriver[] = [];

    for (const raw of availableDrivers) {
      const driver = driverRecordMap.get(raw.driverId);
      if (!driver || !driver.car) continue;
      const vehicle = vehicleMap.get(driver.car);
      if (!vehicle) continue;

      const resolvedVehicleTypeId = raw.vehicleTypeId || VEHICLE_TYPE_MAP[vehicle.vehicleType] || vehicleTypeId;
      const distanceKm = calculateDistance(pickupLat, pickupLon, raw.location.lat, raw.location.lng);
      const etaMinutes = estimateEtaMinutes(distanceKm);
      const rating = Number(driver.rating || 0);
      const completedRides = completedMap.get(driver.id) || 0;
      const income = incomeMap.get(driver.id) || 0;
      const hoursWorked = hoursMap.get(driver.id) || 0;
      const incomePerHour = hoursWorked > 0 ? income / hoursWorked : income;
      const ratingScore =
        rating >= 5
          ? 10
          : rating >= 4.5
            ? 8
            : rating >= 4
              ? 6
              : rating >= 3.5
                ? 4
                : rating >= 3
                  ? 2
                  : 0;
      const experienceScore = Math.floor(completedRides / 100) * 3;

      candidates.push({
        driverId: driver.id,
        vehicleId: vehicle.id,
        vehicleTypeId: resolvedVehicleTypeId,
        location: raw.location,
        distanceKm,
        etaMinutes,
        income,
        incomePerHour,
        hoursWorked,
        rating,
        ratingScore,
        completedRides,
        experienceScore
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        ok: true,
        vehicles: [],
        totalAvailable: 0,
        selectedCount: 0,
        windowUsed: 'none',
        selectionMode: 'none',
        useDatabaseFallback
      });
    }

    const shortlist = [...candidates]
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, DISTANCE_MATRIX_LIMIT);

    if (shortlist.length > 0) {
      const destinations = shortlist.map((candidate) => candidate.location);
      const distanceResults = await getDistanceAndDuration(
        [{ lat: pickupLat, lng: pickupLon }],
        destinations
      );

      distanceResults.forEach((result: { distance: number; duration: number } | null, index: number) => {
        if (!result) return;
        const candidate = shortlist[index];
        if (!candidate) return;
        candidate.distanceKm = result.distance;
        candidate.etaMinutes = Math.ceil(result.duration);
      });
    }

    const priorityTypes = getPriorityTypes(vehicleTypeId);
    const allowedTypes = getAllowedTypes(vehicleTypeId);

    let windowUsed: '0-5' | '5-10' | '10-20' | 'none' = 'none';
    let selectionMode: 'score' | 'closest' | 'none' = 'none';
    let selected: CandidateDriver[] = [];
    let profitabilityChecked = false;

    // Window 0-5 minutes with priority by type
    for (const type of priorityTypes) {
      const shortCandidates = candidates.filter((c) => c.vehicleTypeId === type && c.etaMinutes <= SHORT_WINDOW_MINUTES);
      if (shortCandidates.length > 0) {
        windowUsed = '0-5';
        selectionMode = 'score';
        selected = sortByScore(shortCandidates).slice(0, maxVehicles);
        break;
      }
    }

    // Window 5-10 minutes
    if (selected.length === 0) {
      const midCandidates = candidates.filter(
        (c) =>
          allowedTypes.includes(c.vehicleTypeId) &&
          c.etaMinutes > SHORT_WINDOW_MINUTES &&
          c.etaMinutes <= MID_WINDOW_MINUTES
      );

      if (midCandidates.length > 0) {
        windowUsed = '5-10';
        if (vehicleTypeId === 2) {
          selectionMode = 'closest';
          selected = sortByClosest(midCandidates).slice(0, maxVehicles);
        } else {
          selectionMode = 'score';
          selected = sortByScore(midCandidates).slice(0, maxVehicles);
        }
      }
    }

    // Window 10-20 minutes with profitability check
    if (selected.length === 0) {
      const longCandidates = candidates.filter(
        (c) =>
          allowedTypes.includes(c.vehicleTypeId) &&
          c.etaMinutes > MID_WINDOW_MINUTES &&
          c.etaMinutes <= LONG_WINDOW_MINUTES
      );

      if (longCandidates.length > 0) {
        windowUsed = '10-20';
        selectionMode = 'closest';
        let filtered = longCandidates;

        if (dropoffLat !== undefined && dropoffLon !== undefined && dropoffLat !== null && dropoffLon !== null) {
          profitabilityChecked = true;
          const tripDistance = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
          const tripTimeMin = estimateEtaMinutes(tripDistance);

          const filteredCandidates: CandidateDriver[] = [];
          for (const candidate of longCandidates) {
            const totalTimeHours = (candidate.etaMinutes + tripTimeMin) / 60;
            if (totalTimeHours <= 0) continue;
            const price = await computePrice(tripDistance, tripTimeMin, now, candidate.vehicleTypeId);
            const pricePerHour = price / totalTimeHours;
            const threshold = getHourlyRateThreshold(candidate.vehicleTypeId, now);
            if (pricePerHour >= threshold) {
              filteredCandidates.push(candidate);
            }
          }
          filtered = filteredCandidates;
        }

        if (filtered.length > 0) {
          selected = sortByClosest(filtered).slice(0, maxVehicles);
        }
      }
    }

    const selectedVehicleIds = selected.map((s) => s.vehicleId);

    // === اقتراح driverQueue للرحلات المجدولة بناءً على أقرب سائق ينهي رحلة قريبة مكانياً خلال 25 دقيقة ===
    let recommendedQueue: number[] = [];
    if (scheduledPickupTime && pickupLat !== undefined && pickupLon !== undefined) {
      const targetPickup = new Date(scheduledPickupTime);
      if (!Number.isNaN(targetPickup.getTime())) {
        try {
          const windowStart = new Date(targetPickup.getTime() - CHAIN_LOOKBACK_HOURS * 60 * 60 * 1000);
          const windowEnd = new Date(targetPickup.getTime() + CHAIN_LOOKAHEAD_HOURS * 60 * 60 * 1000);

          const chainRides = await prisma.ride.findMany({
            where: {
              driverId: { not: null },
              scheduled: true,
              pickupTime: { gte: windowStart, lte: windowEnd },
              status: { notIn: ['CANCELED', 'COMPLETED', 'REFUNDED'] }
            },
            select: {
              driverId: true,
              pickupTime: true,
              durationMin: true,
              distanceKm: true,
              endLatLon: true
            }
          });

          const chainCandidates = chainRides
            .map((ride: any) => {
              const endAt = computeRideEndTime(ride.pickupTime ? new Date(ride.pickupTime) : null, ride.durationMin, ride.distanceKm);
              const endLoc = ride.endLatLon;
              if (!endAt || !endLoc?.lat || !endLoc?.lon) return null;
              const distanceKmToNew = calculateDistance(pickupLat, pickupLon, endLoc.lat, endLoc.lon);
              const etaMinutes = estimateEtaMinutes(distanceKmToNew);
              const gapMinutes = (targetPickup.getTime() - endAt.getTime()) / 60000;
              if (etaMinutes <= CHAIN_MAX_TRAVEL_MINUTES && gapMinutes >= -5) {
                return {
                  driverId: ride.driverId as number,
                  etaMinutes,
                  gapMinutes
                };
              }
              return null;
            })
            .filter(Boolean) as { driverId: number; etaMinutes: number; gapMinutes: number; }[];

          chainCandidates.sort((a, b) => {
            if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
            return a.gapMinutes - b.gapMinutes;
          });

          const seen = new Set<number>();
          recommendedQueue = chainCandidates
            .map((c) => c.driverId)
            .filter((id) => {
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            });
        } catch (err) {
          console.error('vehicle-selection: failed to build recommendedQueue for scheduled ride', err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      vehicles: selectedVehicleIds,
      totalAvailable: candidates.length,
      selectedCount: selectedVehicleIds.length,
      windowUsed,
      selectionMode,
      profitabilityChecked,
      useDatabaseFallback,
      longWait: windowUsed === '10-20',
      strategy: 'Custom: 0-5 priority types, 5-10 fallback, 10-20 profitability check',
      recommendedQueue,
      scores: selected.map((s) => ({
        vehicleId: s.vehicleId,
        driverId: s.driverId,
        vehicleTypeId: s.vehicleTypeId,
        etaMinutes: s.etaMinutes,
        distanceKm: Math.round(s.distanceKm * 10) / 10,
        income: s.income,
        incomePerHour: Math.round(s.incomePerHour * 100) / 100,
        hoursWorked: Math.round(s.hoursWorked * 100) / 100,
        rating: s.rating,
        ratingScore: s.ratingScore,
        completedRides: s.completedRides,
        experienceScore: s.experienceScore
      }))
    });
  } catch (error) {
    console.error('Error in vehicle selection:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error during vehicle selection'
      },
      { status: 500 }
    );
  }
}
