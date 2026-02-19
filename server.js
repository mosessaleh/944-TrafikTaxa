const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { setSocketServer } = require('./lib/socket-server');
const { connectedDrivers } = require('./lib/connected-drivers');
const realtimeService = require('./lib/realtime-service');
const DriverStatusMonitor = require('./lib/driver-status-monitor');
const { sendPushToDriver } = require('./lib/notification-service');
const { sendEmail } = require('./lib/email');
const { chargeCancellationFee } = require('./lib/payment-processor');
const { Expo, ExpoPushMessage, ExpoPushToken } = require('expo-server-sdk');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();
const SOCKET_JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret';

// In-memory storage for rejected rides
const rejectedRides = new Map(); // rideId -> Set of driverIds who rejected
global.rejectedRides = rejectedRides;

// In-memory storage for active ride offers
const activeOffers = new Map(); // rideId -> driverId currently being offered
global.activeOffers = activeOffers;

// In-memory storage for pickup proximity notifications sent
const pickupProximitySent = new Map(); // rideId_driverId -> { driverId, sentAt, countdownStart, countdownDuration, distanceMeters }
global.pickupProximitySent = pickupProximitySent;
const scheduledLateWarnings = new Map(); // rideId_driverId -> { lastStage, lastSentAt }
global.scheduledLateWarnings = scheduledLateWarnings;
const scheduledLateReassignments = new Map(); // rideId -> { status, attemptedAt, driverId, newDriverId }
global.scheduledLateReassignments = scheduledLateReassignments;

const PICKUP_PROXIMITY_THRESHOLD_METERS = 30;
const PICKUP_COUNTDOWN_DURATION_SEC = 300;

// Scheduled ride offers (in-app only)
const scheduledOffers = new Map(); // rideId -> offer state
global.scheduledOffers = scheduledOffers;
const SCHEDULED_OFFER_TIMEOUT_MS = 15000; // 15 seconds
const SCHEDULED_MAX_ETA_MINUTES = 30;
const SCHEDULED_CONFLICT_WINDOW_HOURS = 6;
const SCHEDULED_IMMEDIATE_WINDOW_MINUTES = 15;
const SCHEDULED_CHAIN_MAX_GAP_MINUTES = 15;
const SCHEDULED_CHAIN_MAX_TRAVEL_MINUTES = 15;
const SCHEDULED_PICKUP_BUFFER_MINUTES = 7;
const SCHEDULED_LATE_BUFFER_MINUTES = SCHEDULED_PICKUP_BUFFER_MINUTES;
const SCHEDULED_LATE_MAX_STAGE = Math.max(1, SCHEDULED_LATE_BUFFER_MINUTES - 1);
const SCHEDULED_LATE_REASSIGN_THRESHOLD_MINUTES = 3;
const SCHEDULED_LATE_PENALTY_MINUTES = 5;
const SCHEDULED_LATE_RATING_PENALTY = 0.01;

const VEHICLE_TYPE_MAP = {
  SEDAN5: 1,
  SEVEN_NO_BAG: 2,
  VAN: 3,
  LIMO: 4
};

const PRIORITY_TYPES = {
  1: [1, 2, 3, 4],
  2: [2, 3],
  3: [3],
  4: [4]
};

const ALLOWED_TYPES = {
  1: [1, 2, 3, 4],
  2: [2, 3],
  3: [3],
  4: [4]
};

function normalizeDriverQueue(queue) {
  if (!Array.isArray(queue)) return [];
  return queue
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function buildRidePayload(ride) {
  return {
    id: ride.id,
    pickupAddress: ride.pickupAddress,
    stopAddress: ride.stopAddress || null,
    dropoffAddress: ride.dropoffAddress,
    price: ride.price,
    distanceKm: ride.distanceKm,
    riderName: ride.riderName,
    startLatLon: ride.startLatLon,
    stopLatLon: ride.stopLatLon || null,
    endLatLon: ride.endLatLon,
    vehicleTypeId: ride.vehicleTypeId,
    pickupTime: ride.pickupTime
  };
}

function isDriverInActiveOffer(driverId) {
  for (const activeDriverId of activeOffers.values()) {
    if (activeDriverId === driverId) {
      return true;
    }
  }
  return false;
}

async function getMergedBanUntil(driverId, proposedUntil) {
  if (!driverId || !proposedUntil) return proposedUntil;
  try {
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { bannedUntil: true }
    });
    if (driver?.bannedUntil) {
      const existing = new Date(driver.bannedUntil);
      if (!Number.isNaN(existing.getTime()) && existing > proposedUntil) {
        return existing;
      }
    }
  } catch (error) {
    console.error(`Error reading bannedUntil for driver ${driverId}:`, error);
  }
  return proposedUntil;
}

function scheduleAutoUnban(driverId, delayMs) {
  setTimeout(async () => {
    try {
      const driver = await prisma.comDriver.findUnique({
        where: { id: driverId },
        select: { bannedUntil: true }
      });
      if (!driver?.bannedUntil) return;
      const bannedUntil = new Date(driver.bannedUntil);
      if (Number.isNaN(bannedUntil.getTime())) return;
      if (bannedUntil <= new Date()) {
        await prisma.comDriver.update({
          where: { id: driverId },
          data: { bannedUntil: null }
        });
        console.log(`Unbanned driver ${driverId} after timeout`);
      }
    } catch (error) {
      console.error(`Error unbanning driver ${driverId}:`, error);
    }
  }, delayMs);
}

// Function to get available vehicles for a ride
async function getAvailableVehiclesForRide(ride) {
  try {
    const rideDetails = await prisma.ride.findUnique({
      where: { id: ride.id },
      select: {
        startLatLon: true,
        vehicleTypeId: true
      }
    });

    if (!rideDetails || !rideDetails.startLatLon) {
      console.log(`Ride ${ride.id} missing location data`);
      return [];
    }

    // Get excluded driver IDs (rejected for this ride)
    const rejectedDrivers = global.rejectedRides?.get(ride.id) || new Set();
    const excludedDriverIds = Array.from(rejectedDrivers);

    const response = await fetch(`http://localhost:3000/api/vehicle-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pickupLat: rideDetails.startLatLon.lat,
        pickupLon: rideDetails.startLatLon.lon,
        vehicleTypeId: rideDetails.vehicleTypeId,
        maxVehicles: 3,
        excludedDriverIds
      })
    });

    if (!response.ok) {
      console.log(`Failed to get available vehicles for ride ${ride.id}`);
      return [];
    }

    const data = await response.json();

    if (!data.vehicles || data.vehicles.length === 0) {
      console.log(`No vehicles available for ride ${ride.id}`);
      return [];
    }

    const vehicles = await prisma.comVehicles.findMany({
      where: {
        id: { in: data.vehicles }
      },
      select: {
        id: true,
        regNumber: true
      }
    });

    const carPlates = vehicles.map(v => v.regNumber);
    const drivers = await prisma.comDriver.findMany({
      where: {
        car: { in: carPlates }
      },
      select: {
        id: true,
        car: true
      }
    });

    const driverMap = new Map(drivers.map(d => [d.car, d.id]));

    const vehicleInfo = await Promise.all(vehicles.map(async (vehicle, index) => {
      const driverId = driverMap.get(vehicle.regNumber);
      if (!driverId) return `car${index + 1}: [${vehicle.id}, unknown, unknown]`;

      const connectedDriver = connectedDrivers?.get(driverId);
      let distance = 'unknown';

      if (connectedDriver && connectedDriver.location) {
        const lat1 = rideDetails.startLatLon.lat;
        const lon1 = rideDetails.startLatLon.lon;
        const lat2 = connectedDriver.location.lat;
        const lon2 = connectedDriver.location.lng;

        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceKm = R * c;
        const timeMinutes = Math.ceil(distanceKm * 2);
        distance = timeMinutes.toString();
      } else {
        try {
          const driverLocation = await prisma.comDriver.findUnique({
            where: { id: driverId },
            select: { lastLocation: true }
          });

          if (driverLocation && driverLocation.lastLocation && Array.isArray(driverLocation.lastLocation)) {
            const lat2 = driverLocation.lastLocation[0];
            const lon2 = driverLocation.lastLocation[1];

            const lat1 = rideDetails.startLatLon.lat;
            const lon1 = rideDetails.startLatLon.lon;

            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceKm = R * c;
            const timeMinutes = Math.ceil(distanceKm * 2);
            distance = timeMinutes.toString();
          }
        } catch (error) {
          console.error(`Error getting location for driver ${driverId}:`, error);
        }
      }

      return `car${index + 1}: [${vehicle.id}, ${driverId}, ${distance}]`;
    }));

    return vehicleInfo;
  } catch (error) {
    console.error(`Error getting available vehicles for ride ${ride.id}:`, error);
    return [];
  }
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateEtaMinutesFromDistance(distanceKm) {
  return Math.max(1, Math.ceil(distanceKm * 2));
}

function getAllowedTypes(vehicleTypeId) {
  return ALLOWED_TYPES[vehicleTypeId] || [vehicleTypeId];
}

function getPriorityTypes(vehicleTypeId) {
  return PRIORITY_TYPES[vehicleTypeId] || [vehicleTypeId];
}

function resolveVehicleTypeId(rawTypeId, vehicleTypeKey, fallbackTypeId) {
  if (rawTypeId && !Number.isNaN(Number(rawTypeId))) return Number(rawTypeId);
  if (vehicleTypeKey && VEHICLE_TYPE_MAP[vehicleTypeKey]) return VEHICLE_TYPE_MAP[vehicleTypeKey];
  return fallbackTypeId;
}

function getRideDurationMinutes(ride) {
  if (ride?.durationMin && !Number.isNaN(Number(ride.durationMin))) {
    return Math.max(1, Number(ride.durationMin));
  }
  if (ride?.distanceKm && !Number.isNaN(Number(ride.distanceKm))) {
    return Math.max(1, Math.ceil(Number(ride.distanceKm) * 2));
  }
  return 30;
}

async function filterConflictingDrivers(candidates, ride) {
  if (!candidates.length) return candidates;

  const scheduledStart = new Date(ride.pickupTime);
  const scheduledDuration = getRideDurationMinutes(ride);
  const scheduledEnd = new Date(scheduledStart.getTime() + scheduledDuration * 60000);

  const windowStart = new Date(scheduledStart.getTime() - SCHEDULED_CONFLICT_WINDOW_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(scheduledEnd.getTime() + SCHEDULED_CONFLICT_WINDOW_HOURS * 60 * 60 * 1000);

  const rides = await prisma.ride.findMany({
    where: {
      driverId: { in: candidates.map((c) => c.driverId) },
      status: { notIn: ['CANCELED', 'COMPLETED', 'REFUNDED'] },
      pickupTime: { gte: windowStart, lte: windowEnd }
    },
    select: {
      id: true,
      driverId: true,
      pickupTime: true,
      durationMin: true,
      distanceKm: true,
      status: true,
      scheduled: true,
      endLatLon: true
    }
  });

  const ridesByDriver = new Map();
  for (const existing of rides) {
    if (!ridesByDriver.has(existing.driverId)) {
      ridesByDriver.set(existing.driverId, []);
    }
    ridesByDriver.get(existing.driverId).push(existing);
  }

  const filtered = [];
  for (const candidate of candidates) {
    const driverRides = ridesByDriver.get(candidate.driverId) || [];
    let hasConflict = false;
    let bestChain = null;

    for (const existing of driverRides) {
      if (!existing.pickupTime) continue;
      const start = new Date(existing.pickupTime);
      const duration = getRideDurationMinutes(existing);
      const end = new Date(start.getTime() + duration * 60000);

      if (start <= scheduledEnd && end >= scheduledStart) {
        hasConflict = true;
        break;
      }

      if (existing.scheduled && end <= scheduledStart) {
        const gapMinutes = (scheduledStart.getTime() - end.getTime()) / 60000;
        if (gapMinutes <= SCHEDULED_CHAIN_MAX_GAP_MINUTES) {
          const endLatLon = existing.endLatLon;
          const startLatLon = ride.startLatLon;
          if (endLatLon && startLatLon) {
            const distanceKm = calculateDistanceKm(
              endLatLon.lat,
              endLatLon.lon,
              startLatLon.lat,
              startLatLon.lon
            );
            const etaMinutes = estimateEtaMinutesFromDistance(distanceKm);
            if (etaMinutes <= SCHEDULED_CHAIN_MAX_TRAVEL_MINUTES) {
              const shouldReplace =
                !bestChain ||
                etaMinutes < bestChain.etaMinutes ||
                (etaMinutes === bestChain.etaMinutes && gapMinutes < bestChain.gapMinutes);
              if (shouldReplace) {
                bestChain = {
                  rideId: existing.id,
                  gapMinutes,
                  distanceKm,
                  etaMinutes
                };
              }
            }
          }
        }
      }
    }

    if (hasConflict) continue;

    if (bestChain) {
      candidate.chainPriority = true;
      candidate.chainRideId = bestChain.rideId;
      candidate.chainGapMinutes = bestChain.gapMinutes;
      candidate.chainDistanceKm = bestChain.distanceKm;
      candidate.chainEtaMinutes = bestChain.etaMinutes;
      candidate.distanceKm = bestChain.distanceKm;
      candidate.etaMinutes = bestChain.etaMinutes;
    }

    if (candidate.etaMinutes > SCHEDULED_MAX_ETA_MINUTES) {
      continue;
    }

    filtered.push(candidate);
  }

  return filtered;
}

async function buildScheduledCandidates(ride) {
  if (!ride || !ride.startLatLon) return [];

  const rawDrivers = Array.from(connectedDrivers.entries())
    .filter(([, driverData]) =>
      driverData?.location &&
      typeof driverData.location.lat === 'number' &&
      typeof driverData.location.lng === 'number'
    )
    .map(([driverId, driverData]) => ({
      driverId: Number(driverId),
      location: driverData.location,
      vehicleTypeId: driverData.vehicleTypeId ? Number(driverData.vehicleTypeId) : null
    }));

  if (rawDrivers.length === 0) return [];

  const driverIds = rawDrivers.map((d) => d.driverId);
  const now = new Date();

  const driverRecords = await prisma.comDriver.findMany({
    where: {
      id: { in: driverIds },
      isActive: true,
      car: { not: null },
      currentRideId: null,
      isBusy: false,
      isOnline: true,
      OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }]
    },
    select: {
      id: true,
      car: true,
      rating: true
    }
  });

  if (!driverRecords.length) return [];

  const driverRecordMap = new Map(driverRecords.map((d) => [d.id, d]));
  const carPlates = driverRecords.map((d) => d.car).filter(Boolean);

  const vehicles = await prisma.comVehicles.findMany({
    where: { regNumber: { in: carPlates } },
    select: { id: true, regNumber: true, vehicleType: true }
  });

  const vehicleMap = new Map(vehicles.map((v) => [v.regNumber, v]));
  const allowedTypes = getAllowedTypes(ride.vehicleTypeId);

  const candidates = [];

  for (const raw of rawDrivers) {
    const driver = driverRecordMap.get(raw.driverId);
    if (!driver || !driver.car) continue;
    const vehicle = vehicleMap.get(driver.car);
    const resolvedVehicleTypeId = resolveVehicleTypeId(raw.vehicleTypeId, vehicle?.vehicleType, ride.vehicleTypeId);
    if (!resolvedVehicleTypeId || !allowedTypes.includes(resolvedVehicleTypeId)) continue;

    const distanceKm = calculateDistanceKm(
      ride.startLatLon.lat,
      ride.startLatLon.lon,
      raw.location.lat,
      raw.location.lng
    );
    const etaMinutes = estimateEtaMinutesFromDistance(distanceKm);

    candidates.push({
      driverId: driver.id,
      car: driver.car,
      rating: Number(driver.rating || 0),
      vehicleTypeId: resolvedVehicleTypeId,
      location: raw.location,
      distanceKm,
      etaMinutes,
      chainPriority: false,
      chainRideId: null,
      chainGapMinutes: null,
      chainDistanceKm: null,
      chainEtaMinutes: null
    });
  }

  if (!candidates.length) return [];

  return filterConflictingDrivers(candidates, ride);
}

function selectBestScheduledCandidate(candidates, rideVehicleTypeId) {
  if (!candidates || candidates.length === 0) return null;
  const rideTypeId = Number(rideVehicleTypeId);
  const sedanTypeId = VEHICLE_TYPE_MAP.SEDAN5 || 1;
  let selectionPool = [...candidates];

  if (rideTypeId === sedanTypeId) {
    const sedanAccepted = selectionPool.filter((candidate) => candidate.vehicleTypeId === sedanTypeId);
    if (sedanAccepted.length) {
      selectionPool = sedanAccepted;
    }
  }

  selectionPool.sort((a, b) => {
    const aPriority = Boolean(a.chainPriority);
    const bPriority = Boolean(b.chainPriority);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;
    const aGap = Number.isFinite(a.chainGapMinutes) ? a.chainGapMinutes : Number.POSITIVE_INFINITY;
    const bGap = Number.isFinite(b.chainGapMinutes) ? b.chainGapMinutes : Number.POSITIVE_INFINITY;
    if (aGap !== bGap) return aGap - bGap;
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    if (a.rating !== b.rating) return b.rating - a.rating;
    return 0;
  });

  return selectionPool[0] || null;
}

async function assignScheduledRideFromQueue(ride) {
  const queueIds = normalizeDriverQueue(ride.driverQueue);
  if (!queueIds.length) return false;

  const candidates = await buildScheduledCandidates(ride);
  if (!candidates.length) return false;

  const acceptedCandidates = candidates.filter((candidate) => queueIds.includes(candidate.driverId));
  if (!acceptedCandidates.length) return false;

  const selected = selectBestScheduledCandidate(acceptedCandidates, ride.vehicleTypeId);
  if (!selected) return false;

  const driverRecord = await prisma.comDriver.findUnique({
    where: { id: selected.driverId },
    select: { id: true, car: true }
  });

  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      driverId: selected.driverId,
      car: driverRecord?.car || selected.car || null
    }
  });

  const io = global.io;
  if (io) {
    const rideData = buildRidePayload(ride);
    for (const candidate of acceptedCandidates) {
      io.to(`driver_${candidate.driverId}`).emit('scheduledOfferResult', {
        rideId: ride.id,
        selected: candidate.driverId === selected.driverId,
        pickupTime: ride.pickupTime,
        rideData
      });
    }
  }

  console.log(`Scheduled ride ${ride.id} assigned from persisted queue to driver ${selected.driverId}`);
  return true;
}

async function broadcastScheduledRideOffer(ride) {
  if (!ride || !ride.startLatLon || !ride.pickupTime) {
    console.log(`Scheduled ride ${ride?.id} missing location or pickup time`);
    return;
  }

  if (scheduledOffers.has(ride.id)) {
    return;
  }

  try {
    await prisma.ride.update({
      where: { id: ride.id },
      data: { driverQueue: [] }
    });
  } catch (error) {
    console.warn(`Failed to reset driverQueue for scheduled ride ${ride.id}:`, error);
  }

  const candidates = await buildScheduledCandidates(ride);
  if (!candidates.length) {
    console.log(`No eligible drivers for scheduled ride ${ride.id}`);
    return;
  }

  const offerState = {
    rideId: ride.id,
    pickupTime: ride.pickupTime,
    vehicleTypeId: ride.vehicleTypeId,
    candidates,
    accepted: new Map(),
    rejected: new Set(),
    createdAt: Date.now(),
    timeoutMs: SCHEDULED_OFFER_TIMEOUT_MS,
    timerId: null
  };

  scheduledOffers.set(ride.id, offerState);

  const io = global.io;
  if (io) {
    for (const candidate of candidates) {
      io.to(`driver_${candidate.driverId}`).emit('rideOffer', {
        type: 'scheduledRide',
        offerType: 'scheduled',
        scheduled: true,
        rideId: ride.id,
        rideData: {
          ...buildRidePayload(ride)
        },
        timestamp: Date.now(),
        timeoutMs: SCHEDULED_OFFER_TIMEOUT_MS
      });
    }
  }

  offerState.timerId = setTimeout(() => {
    finalizeScheduledOffer(ride.id).catch((error) => {
      console.error(`Error finalizing scheduled offer for ride ${ride.id}:`, error);
    });
  }, SCHEDULED_OFFER_TIMEOUT_MS);
}

async function canDriverAcceptImmediateRide(driverId, ride, driverPickupEtaMinutes = 0, now = new Date()) {
  const upcoming = await prisma.ride.findFirst({
    where: {
      driverId,
      scheduled: true,
      pickupTime: { gt: now },
      status: { notIn: ['CANCELED', 'COMPLETED', 'REFUNDED'] }
    },
    orderBy: { pickupTime: 'asc' },
    select: {
      id: true,
      pickupTime: true,
      startLatLon: true
    }
  });

  if (!upcoming) return { ok: true };
  if (!upcoming.pickupTime) return { ok: true };
  if (!ride?.endLatLon || !upcoming.startLatLon) return { ok: true };

  const pickupEta = Number(driverPickupEtaMinutes || 0);
  const rideDurationMinutes = getRideDurationMinutes(ride);
  const dropoffTime = new Date(now.getTime() + (pickupEta + rideDurationMinutes) * 60000);

  const distanceKm = calculateDistanceKm(
    ride.endLatLon.lat,
    ride.endLatLon.lon,
    upcoming.startLatLon.lat,
    upcoming.startLatLon.lon
  );
  const travelMinutes = estimateEtaMinutesFromDistance(distanceKm);
  const latestArrival = new Date(new Date(upcoming.pickupTime).getTime() - SCHEDULED_PICKUP_BUFFER_MINUTES * 60000);
  const arrivalTime = new Date(dropoffTime.getTime() + travelMinutes * 60000);

  if (arrivalTime > latestArrival) {
    return { ok: false, upcomingRideId: upcoming.id, arrivalTime, latestArrival };
  }

  return { ok: true };
}

async function finalizeScheduledOffer(rideId) {
  const offerState = scheduledOffers.get(rideId);
  if (!offerState) return;

  if (offerState.timerId) {
    clearTimeout(offerState.timerId);
  }

  scheduledOffers.delete(rideId);

  const accepted = Array.from(offerState.accepted.values());
  if (!accepted.length) {
    console.log(`No drivers accepted scheduled ride ${rideId}`);
    return;
  }

  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: {
      id: true,
      status: true,
      driverId: true,
      pickupTime: true,
      pickupAddress: true,
      dropoffAddress: true,
      stopAddress: true,
      price: true,
      distanceKm: true,
      startLatLon: true,
      stopLatLon: true,
      endLatLon: true,
      vehicleTypeId: true
    }
  });

  if (!ride || ride.status !== 'CONFIRMED' || ride.driverId) {
    console.log(`Scheduled ride ${rideId} no longer available for assignment`);
    return;
  }

  const acceptedDriverIds = Array.from(new Set(accepted.map((candidate) => candidate.driverId)));
  const eligibleCandidates = [];
  const driverInfoMap = new Map();
  const now = new Date();

  for (const candidate of accepted) {
    try {
      const driver = await prisma.comDriver.findUnique({
        where: { id: candidate.driverId },
        select: {
          id: true,
          car: true,
          drFname: true,
          drLname: true,
          isOnline: true,
          isBusy: true,
          currentRideId: true,
          bannedUntil: true,
          isActive: true
        }
      });

      if (!driver || !driver.isActive) continue;
      if (!driver.isOnline || driver.isBusy) continue;
      if (driver.currentRideId && driver.currentRideId !== rideId) continue;
      if (driver.bannedUntil && driver.bannedUntil > now) continue;
      if (!connectedDrivers.has(candidate.driverId)) continue;

      eligibleCandidates.push(candidate);
      driverInfoMap.set(candidate.driverId, driver);
    } catch (error) {
      console.error(`Error validating scheduled driver ${candidate.driverId}:`, error);
    }
  }

  if (!eligibleCandidates.length) {
    console.log(`No eligible drivers available for scheduled ride ${rideId}`);
    return;
  }

  const selected = selectBestScheduledCandidate(eligibleCandidates, ride.vehicleTypeId);
  if (!selected) {
    console.log(`No suitable driver found after sorting for scheduled ride ${rideId}`);
    return;
  }

  const selectedDriver = driverInfoMap.get(selected.driverId);

  await prisma.ride.update({
    where: { id: rideId },
    data: {
      driverId: selected.driverId,
      car: selectedDriver?.car || selected.car || null,
      driverQueue: acceptedDriverIds
    }
  });

  const io = global.io;
  if (io) {
    const rideData = buildRidePayload(ride);
    io.to(`driver_${selected.driverId}`).emit('scheduledOfferResult', {
      rideId,
      selected: true,
      pickupTime: ride.pickupTime,
      rideData
    });

    for (const candidate of accepted) {
      if (candidate.driverId === selected.driverId) continue;
      io.to(`driver_${candidate.driverId}`).emit('scheduledOfferResult', {
        rideId,
        selected: false,
        pickupTime: ride.pickupTime,
        rideData
      });
    }
  }
}

async function dispatchScheduledRide(ride, minutesToPickup) {
  if (!ride?.driverId) return false;

  const queueIds = normalizeDriverQueue(ride.driverQueue);
  const candidateIds = [ride.driverId, ...queueIds.filter((id) => id !== ride.driverId)];
  const now = new Date();
  let selectedDriver = null;
  let selectedDriverInfo = null;

  for (const candidateId of candidateIds) {
    try {
      const driver = await prisma.comDriver.findUnique({
        where: { id: candidateId },
        select: {
          id: true,
          drFname: true,
          drLname: true,
          car: true,
          isOnline: true,
          isBusy: true,
          currentRideId: true,
          bannedUntil: true,
          isActive: true
        }
      });

      if (!driver || !driver.isActive) continue;
      if (!driver.isOnline || driver.isBusy) continue;
      if (driver.currentRideId && driver.currentRideId !== ride.id) continue;
      if (driver.bannedUntil && driver.bannedUntil > now) continue;
      if (!connectedDrivers.has(candidateId)) continue;
      if (isDriverInActiveOffer(candidateId)) continue;

      selectedDriver = candidateId;
      selectedDriverInfo = driver;
      break;
    } catch (error) {
      console.error(`Error checking scheduled driver ${candidateId} for ride ${ride.id}:`, error);
    }
  }

  if (!selectedDriver || !selectedDriverInfo) {
    console.log(`No available driver to dispatch scheduled ride ${ride.id}`);
    return false;
  }

  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'DISPATCHED',
      driverId: selectedDriver,
      car: selectedDriverInfo.car || ride.car || null,
      acceptedAt: new Date()
    }
  });

  await prisma.comDriver.update({
    where: { id: selectedDriver },
    data: {
      currentRideId: ride.id,
      rideAccepted: 1,
      isBusy: true
    }
  });

  const io = global.io;
  const timestamp = new Date().toISOString();
  if (io) {
    const driverPayload = {
      id: selectedDriverInfo.id,
      firstName: selectedDriverInfo.drFname,
      lastName: selectedDriverInfo.drLname,
      name: `${selectedDriverInfo.drFname} ${selectedDriverInfo.drLname}`,
      car: selectedDriverInfo.car
    };

    io.to(`driver_${selectedDriver}`).emit('rideAccepted', { rideId: ride.id });
    io.to(`driver_${selectedDriver}`).emit('driverStatusUpdate', {
      currentRideId: ride.id,
      isBusy: true,
      rideAccepted: 1
    });
    io.to(`driver_${selectedDriver}`).emit('ride-update', {
      rideId: ride.id,
      status: 'DISPATCHED',
      timestamp
    });
    io.to(`booking_${ride.id}`).emit('bookingUpdate', {
      bookingId: ride.id,
      status: 'DISPATCHED',
      driverId: selectedDriver,
      driver: driverPayload,
      timestamp
    });
    io.to(`booking_${ride.id}`).emit('driverInfoUpdate', {
      bookingId: ride.id,
      driverId: selectedDriver,
      driver: driverPayload,
      location: null,
      eta: null,
      timestamp
    });
  }

  try {
    realtimeService.sendBookingUpdate(ride.id, {
      bookingId: ride.id,
      status: 'DISPATCHED',
      driverId: selectedDriver,
      driver: selectedDriverInfo,
      timestamp
    });
  } catch (error) {
    console.error('Error sending realtime booking update for scheduled dispatch:', error);
  }

  console.log(`Scheduled ride ${ride.id} dispatched to driver ${selectedDriver} (${minutesToPickup ?? 'n/a'} min to pickup)`);
  return true;
}

function getMinutesUntilPickup(pickupTime, now = new Date()) {
  if (!pickupTime) return null;
  const pickupDate = pickupTime instanceof Date ? pickupTime : new Date(pickupTime);
  if (Number.isNaN(pickupDate.getTime())) return null;
  return (pickupDate.getTime() - now.getTime()) / 60000;
}

function getScheduledLateStage(minutesBeforePickup) {
  if (!Number.isFinite(minutesBeforePickup)) return null;
  const stage = SCHEDULED_LATE_BUFFER_MINUTES - Math.ceil(minutesBeforePickup);
  if (stage < 1 || stage > SCHEDULED_LATE_MAX_STAGE) return null;
  return stage;
}

async function applyLatePenaltyToDriver(driverId) {
  if (!driverId) return null;
  const now = new Date();
  const penaltyUntil = new Date(now.getTime() + SCHEDULED_LATE_PENALTY_MINUTES * 60000);
  try {
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { rating: true, bannedUntil: true, penaltyUntil: true }
    });
    if (!driver) return null;

    const currentRating = Number(driver.rating || 0);
    const nextRating = Math.max(0, Number((currentRating - SCHEDULED_LATE_RATING_PENALTY).toFixed(2)));
    const existingPenalty = driver.penaltyUntil ? new Date(driver.penaltyUntil) : null;
    const mergedPenalty = existingPenalty && existingPenalty > penaltyUntil ? existingPenalty : penaltyUntil;
    const mergedBan = driver.bannedUntil && driver.bannedUntil > penaltyUntil ? driver.bannedUntil : penaltyUntil;

    await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        rating: nextRating,
        penaltyUntil: mergedPenalty,
        bannedUntil: mergedBan
      }
    });
    return mergedBan;
  } catch (error) {
    console.error(`Error applying late penalty to driver ${driverId}:`, error);
    return null;
  }
}

async function reassignScheduledRideDueToLate(ride, originalDriverId, candidates) {
  if (!ride || !originalDriverId) return false;

  const currentRide = await prisma.ride.findUnique({
    where: { id: ride.id },
    select: {
      id: true,
      status: true,
      driverId: true,
      pickupTime: true,
      pickupAddress: true,
      dropoffAddress: true,
      stopAddress: true,
      price: true,
      distanceKm: true,
      riderName: true,
      startLatLon: true,
      stopLatLon: true,
      endLatLon: true,
      vehicleTypeId: true,
      driverQueue: true,
      car: true
    }
  });

  if (!currentRide || currentRide.driverId !== originalDriverId) {
    return false;
  }

  if (!['CONFIRMED', 'DISPATCHED', 'ONGOING', 'IN_PROGRESS'].includes(currentRide.status)) {
    return false;
  }

  const availableCandidates = candidates && candidates.length
    ? candidates
    : await buildScheduledCandidates(currentRide);

  if (!availableCandidates || availableCandidates.length === 0) {
    scheduledLateReassignments.set(currentRide.id, {
      status: 'no_candidates',
      attemptedAt: Date.now(),
      driverId: originalDriverId
    });
    console.log(`Scheduled late reassignment skipped for ride ${currentRide.id} (no candidates)`);
    return false;
  }

  const allowedIds = normalizeDriverQueue(currentRide.driverQueue);
  let filteredCandidates = allowedIds.length
    ? availableCandidates.filter((candidate) => allowedIds.includes(candidate.driverId))
    : availableCandidates;

  const minutesToPickup = getMinutesUntilPickup(currentRide.pickupTime, new Date());
  if (minutesToPickup !== null) {
    filteredCandidates = filteredCandidates.filter((candidate) => {
      if (!Number.isFinite(candidate?.etaMinutes)) return false;
      const minutesBeforePickup = minutesToPickup - candidate.etaMinutes;
      return minutesBeforePickup >= -SCHEDULED_LATE_REASSIGN_THRESHOLD_MINUTES;
    });
  }

  filteredCandidates = filteredCandidates.filter((candidate) => candidate.driverId !== originalDriverId);

  if (filteredCandidates.length === 0) {
    scheduledLateReassignments.set(currentRide.id, {
      status: 'no_candidates',
      attemptedAt: Date.now(),
      driverId: originalDriverId
    });
    console.log(`Scheduled late reassignment skipped for ride ${currentRide.id} (no queued candidates)`);
    return false;
  }

  const selected = selectBestScheduledCandidate(filteredCandidates, currentRide.vehicleTypeId);
  if (!selected) {
    scheduledLateReassignments.set(currentRide.id, {
      status: 'no_candidates',
      attemptedAt: Date.now(),
      driverId: originalDriverId
    });
    return false;
  }

  const newDriverInfo = await prisma.comDriver.findUnique({
    where: { id: selected.driverId },
    select: { id: true, car: true, drFname: true, drLname: true }
  });

  await prisma.ride.update({
    where: { id: currentRide.id },
    data: {
      driverId: selected.driverId,
      car: newDriverInfo?.car || selected.car || null
    }
  });

  const shouldDispatch = currentRide.status !== 'CONFIRMED';
  if (shouldDispatch) {
    await prisma.comDriver.update({
      where: { id: selected.driverId },
      data: {
        currentRideId: currentRide.id,
        rideAccepted: 1,
        isBusy: true
      }
    });
  }

  const originalDriver = await prisma.comDriver.findUnique({
    where: { id: originalDriverId },
    select: { currentRideId: true }
  });
  if (originalDriver?.currentRideId === currentRide.id) {
    await prisma.comDriver.update({
      where: { id: originalDriverId },
      data: {
        currentRideId: null,
        isBusy: false,
        rideAccepted: 0
      }
    });
  }

  clearScheduledOfferState(currentRide.id, 'Scheduled ride reassigned due to late arrival');

  const proximityKey = `${currentRide.id}_${originalDriverId}`;
  if (global.pickupProximitySent?.has?.(proximityKey)) {
    global.pickupProximitySent.delete(proximityKey);
  }
  if (global.scheduledLateWarnings?.has?.(proximityKey)) {
    global.scheduledLateWarnings.delete(proximityKey);
  }

  const penaltyUntilValue = await applyLatePenaltyToDriver(originalDriverId);
  const penaltyUntil = penaltyUntilValue || new Date(Date.now() + SCHEDULED_LATE_PENALTY_MINUTES * 60000);

  const io = global.io;
  const timestamp = new Date().toISOString();
  if (io) {
    io.to(`driver_${originalDriverId}`).emit('rideCancelled', {
      rideId: currentRide.id,
      reason: 'Scheduled ride reassigned due to late arrival'
    });

    io.to(`driver_${originalDriverId}`).emit('driverStatusUpdate', {
      currentRideId: null,
      isBusy: false,
      rideAccepted: 0,
      bannedUntil: penaltyUntil.toISOString()
    });

    const rideData = buildRidePayload(currentRide);
    if (shouldDispatch) {
      io.to(`driver_${selected.driverId}`).emit('rideAccepted', { rideId: currentRide.id });
      io.to(`driver_${selected.driverId}`).emit('driverStatusUpdate', {
        currentRideId: currentRide.id,
        isBusy: true,
        rideAccepted: 1
      });
      io.to(`driver_${selected.driverId}`).emit('ride-update', {
        rideId: currentRide.id,
        status: currentRide.status,
        timestamp
      });
    }
    io.to(`driver_${selected.driverId}`).emit('scheduledOfferResult', {
      rideId: currentRide.id,
      selected: true,
      pickupTime: currentRide.pickupTime,
      rideData
    });

    io.to(`booking_${currentRide.id}`).emit('bookingUpdate', {
      bookingId: currentRide.id,
      status: currentRide.status,
      driverId: selected.driverId,
      driver: newDriverInfo
        ? {
            id: newDriverInfo.id,
            firstName: newDriverInfo.drFname,
            lastName: newDriverInfo.drLname,
            name: `${newDriverInfo.drFname} ${newDriverInfo.drLname}`,
            car: newDriverInfo.car
          }
        : null,
      timestamp
    });
    io.to(`booking_${currentRide.id}`).emit('driverInfoUpdate', {
      bookingId: currentRide.id,
      driverId: selected.driverId,
      driver: newDriverInfo
        ? {
            id: newDriverInfo.id,
            drFname: newDriverInfo.drFname,
            drLname: newDriverInfo.drLname,
            car: newDriverInfo.car
          }
        : null,
      location: null,
      eta: null,
      timestamp
    });
  }

  try {
    realtimeService.sendBookingUpdate(currentRide.id, {
      bookingId: currentRide.id,
      status: currentRide.status,
      driverId: selected.driverId,
      driver: newDriverInfo || undefined,
      timestamp
    });
  } catch (error) {
    console.error('Error sending realtime booking update for scheduled reassignment:', error);
  }

  scheduledLateReassignments.set(currentRide.id, {
    status: 'reassigned',
    attemptedAt: Date.now(),
    driverId: originalDriverId,
    newDriverId: selected.driverId
  });

  console.log(`Scheduled ride ${currentRide.id} reassigned from driver ${originalDriverId} to ${selected.driverId}`);
  return true;
}

async function resolveDriverLocation(driverId) {
  if (!driverId) return null;
  const connected = connectedDrivers?.get(driverId);
  if (
    connected?.location &&
    Number.isFinite(connected.location.lat) &&
    Number.isFinite(connected.location.lng)
  ) {
    return connected.location;
  }

  try {
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { lastLocation: true }
    });

    if (driver?.lastLocation && Array.isArray(driver.lastLocation) && driver.lastLocation.length >= 2) {
      const [lat, lng] = driver.lastLocation;
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  } catch (error) {
    console.error(`Error resolving location for driver ${driverId}:`, error);
  }

  return null;
}

async function getScheduledDispatchLeadMinutes(ride) {
  if (!ride?.driverId || !ride?.startLatLon) {
    return SCHEDULED_IMMEDIATE_WINDOW_MINUTES;
  }

  const driverLocation = await resolveDriverLocation(ride.driverId);
  if (!driverLocation) {
    return SCHEDULED_IMMEDIATE_WINDOW_MINUTES;
  }

  const eta = await calculateETA(driverLocation, ride.startLatLon.lat, ride.startLatLon.lon);
  if (!eta || !Number.isFinite(eta.timeMinutes)) {
    return SCHEDULED_IMMEDIATE_WINDOW_MINUTES;
  }

  const leadMinutes = Math.max(1, eta.timeMinutes + SCHEDULED_PICKUP_BUFFER_MINUTES);
  return Math.max(SCHEDULED_IMMEDIATE_WINDOW_MINUTES, leadMinutes);
}

function clearScheduledOfferState(rideId, reason) {
  const offerState = scheduledOffers.get(rideId);
  if (!offerState) return;
  if (offerState.timerId) {
    clearTimeout(offerState.timerId);
  }
  scheduledOffers.delete(rideId);
  const io = global.io;
  if (io && offerState?.candidates?.length) {
    offerState.candidates.forEach((candidate) => {
      io.to(`driver_${candidate.driverId}`).emit('rideCancelled', {
        rideId,
        reason: reason || 'Ride cancelled'
      });
    });
  }
}

async function cancelRideWithRefund(ride, options = {}) {
  const reason = options.reason || 'No vehicles available for this ride';
  const canceledBy = options.canceledBy || 'system';
  const io = global.io;
  const timestamp = new Date().toISOString();

  let paymentResult = null;
  const originalPriceDkk = Math.max(0, Math.round(ride.price || 0));
  const shouldProcessPayment = Boolean(ride.paymentRef || ride.savedPaymentMethodId);

  if (shouldProcessPayment) {
    try {
      paymentResult = await chargeCancellationFee(
        {
          ...ride,
          savedPaymentMethod: ride.savedPaymentMethod
        },
        0,
        originalPriceDkk
      );
    } catch (error) {
      console.error(`Error handling refund/authorization cancel for ride ${ride.id}:`, error);
    }
  }

  let paymentStatus = ride.paymentStatus;
  if (paymentResult?.success) {
    paymentStatus = paymentResult.canceledAuthorization ? 'UNPAID' : 'PAID';
  }

  const explanation = paymentResult?.success
    ? paymentResult.refundId
      ? `Payment refunded - Refund: ${paymentResult.refundId}`
      : paymentResult.canceledAuthorization
        ? 'Authorization canceled - No charge'
        : `Payment updated - Transaction: ${paymentResult.transactionId}`
    : reason;

  await prisma.ride.update({
    where: { id: ride.id },
    data: {
      status: 'CANCELED',
      cancellationReason: reason,
      canceledBy,
      explanation,
      paymentStatus,
      car: null
    }
  });

  if (ride.driverId) {
    const driverRecord = await prisma.comDriver.findUnique({
      where: { id: ride.driverId },
      select: { currentRideId: true }
    });

    if (driverRecord?.currentRideId === ride.id) {
      await prisma.comDriver.update({
        where: { id: ride.driverId },
        data: {
          currentRideId: null,
          isBusy: false,
          rideAccepted: 0
        }
      });
    }
  }

  clearScheduledOfferState(ride.id, reason);

  if (global.activeOffers?.has?.(ride.id)) {
    const driverId = global.activeOffers.get(ride.id);
    if (io && driverId) {
      io.to(`driver_${driverId}`).emit('rideCancelled', { rideId: ride.id, reason });
    }
    global.activeOffers.delete(ride.id);
  }

  if (global.rejectedRides?.has?.(ride.id)) {
    global.rejectedRides.delete(ride.id);
  }

  if (global.scheduledLateReassignments?.has?.(ride.id)) {
    global.scheduledLateReassignments.delete(ride.id);
  }

  if (ride.driverId && global.pickupProximitySent?.has?.(`${ride.id}_${ride.driverId}`)) {
    global.pickupProximitySent.delete(`${ride.id}_${ride.driverId}`);
  }
  if (ride.driverId && global.scheduledLateWarnings?.has?.(`${ride.id}_${ride.driverId}`)) {
    global.scheduledLateWarnings.delete(`${ride.id}_${ride.driverId}`);
  }

  if (ride.driverQueue && Array.isArray(ride.driverQueue)) {
    for (const queuedDriverId of ride.driverQueue) {
      if (queuedDriverId && global.pickupProximitySent?.has?.(`${ride.id}_${queuedDriverId}`)) {
        global.pickupProximitySent.delete(`${ride.id}_${queuedDriverId}`);
      }
      if (queuedDriverId && global.scheduledLateWarnings?.has?.(`${ride.id}_${queuedDriverId}`)) {
        global.scheduledLateWarnings.delete(`${ride.id}_${queuedDriverId}`);
      }
    }
  }

  if (io) {
    if (ride.driverId) {
      io.to(`driver_${ride.driverId}`).emit('rideCancelled', { rideId: ride.id, reason });
    }
    io.to(`booking_${ride.id}`).emit('bookingUpdate', {
      bookingId: ride.id,
      status: 'CANCELED',
      explanation,
      timestamp
    });
    io.to(`user_${ride.userId}`).emit('rideCancelled', {
      rideId: ride.id,
      reason,
      canceledBy,
      message: 'Booking canceled due to unavailability'
    });
  }

  try {
    realtimeService.sendBookingUpdate(ride.id, {
      bookingId: ride.id,
      status: 'CANCELED',
      explanation,
      timestamp
    });
  } catch (error) {
    console.error('Error sending realtime booking update:', error);
  }

  if (ride?.user?.email) {
    const pickupTimeText = ride.pickupTime
      ? new Date(ride.pickupTime).toLocaleString('en-DK')
      : '';
    const customerName = ride.user?.firstName || ride.user?.lastName || 'عزيزي العميل';
    const subject = 'نعتذر عن عدم توفر سيارة لرحلتك';
    const html = `
      <p>مرحباً ${customerName},</p>
      <p>نأسف لإبلاغك بأنه لم نتمكن من توفير سيارة مناسبة لرحلتك رقم <strong>#${ride.id}</strong>${pickupTimeText ? ` بتاريخ <strong>${pickupTimeText}</strong>` : ''}.</p>
      <p>تم إلغاء الرحلة وإلغاء حجز المبلغ/إرجاعه إلى وسيلة الدفع الأصلية حسب الأصول.</p>
      <p>ما يزال بإمكانك محاولة الحجز في أي وقت، وسنسعد بخدمتك.</p>
      <p>نعتذر عن أي إزعاج،<br/>944 Trafik</p>
    `;

    try {
      await sendEmail(ride.user.email, subject, html);
    } catch (emailError) {
      console.error(`[mail] Failed to send cancellation email for ride ${ride.id}:`, emailError);
    }
  }
}

// Function to auto-assign ride to the closest available driver
async function autoAssignRide(ride, vehicleInfo) {
  try {
    console.log(`Starting auto-assign for ride ${ride.id} with ${vehicleInfo.length} potential vehicles`);
    // Parse vehicle info to get driver IDs and times
    const availableDrivers = [];
    for (const info of vehicleInfo) {
      const match = info.match(/car\d+: \[(\d+), (\d+), (\d+)\]/);
      if (match) {
        const [, vehicleId, driverId, timeMinutes] = match;
        availableDrivers.push({
          vehicleId: parseInt(vehicleId),
          driverId: parseInt(driverId),
          timeMinutes: parseInt(timeMinutes)
        });
      }
    }

    // Sort by time (closest first)
    availableDrivers.sort((a, b) => a.timeMinutes - b.timeMinutes);

    // Get rejected drivers for this ride
    const rejectedDrivers = global.rejectedRides?.get(ride.id) || new Set();

    // Try to assign to the closest driver
    for (const driver of availableDrivers) {
      try {
        // Check if driver has rejected this ride
        if (rejectedDrivers.has(driver.driverId)) {
          console.log(`Skipping driver ${driver.driverId} - previously rejected ride ${ride.id}`);
          continue;
        }

        // Check driver conditions
        const driverData = await prisma.comDriver.findUnique({
          where: { id: driver.driverId },
          select: {
            currentRideId: true,
            isOnline: true,
            isBusy: true,
            bannedUntil: true
          }
        });

        if (!driverData) continue;

        if (isDriverInActiveOffer(driver.driverId)) {
          console.log(`Skipping driver ${driver.driverId} - already has active offer`);
          continue;
        }

        // Check if driver is banned
        const now = new Date();
        if (driverData.bannedUntil && driverData.bannedUntil > now) {
          console.log(`Driver ${driver.driverId} is banned until ${driverData.bannedUntil}`);
          continue; // Driver is banned
        }

        // Check conditions: currentRideId = null, isOnline = 1, isBusy = 0
        if (driverData.currentRideId !== null || !driverData.isOnline || driverData.isBusy) {
          continue; // Driver not available
        }

        // Check if driver is still connected in socket
        if (!connectedDrivers.has(driver.driverId)) {
          continue; // Driver not connected
        }

        const scheduledCheck = await canDriverAcceptImmediateRide(
          driver.driverId,
          ride,
          driver.timeMinutes,
          now
        );
        if (!scheduledCheck.ok) {
          console.log(
            `Skipping driver ${driver.driverId} - cannot reach scheduled ride ${scheduledCheck.upcomingRideId} before pickup buffer`
          );
          continue;
        }

        // Send ride offer to driver
        const driverSocket = connectedDrivers.get(driver.driverId);
        console.log(`Checking driver ${driver.driverId} socket:`, !!driverSocket, driverSocket?.socketId);
        if (driverSocket && driverSocket.socketId) {
          const io = global.io;
          if (io) {
            const rideOfferData = {
              type: 'newRide',
              rideId: ride.id,
              rideData: {
                id: ride.id,
                pickupAddress: ride.pickupAddress,
                dropoffAddress: ride.dropoffAddress,
                price: ride.price,
                distanceKm: ride.distanceKm,
                riderName: ride.riderName,
                startLatLon: ride.startLatLon,
                endLatLon: ride.endLatLon,
                vehicleTypeId: ride.vehicleTypeId
              },
              timestamp: Date.now(),
              timeoutMs: 30000 // 30 seconds timeout
            };

            // Mark as active offer before sending
            global.activeOffers.set(ride.id, driver.driverId);

            io.to(`driver_${driver.driverId}`).emit('rideOffer', rideOfferData);
            console.log(`Ride ${ride.id} assigned to driver ${driver.driverId} (${driver.timeMinutes} minutes away)`);
            console.log('Sent rideOffer data:', rideOfferData);
            console.log(`Driver ${driver.driverId} is connected and should receive the offer`);

            // Send push notification to driver
            try {
              await sendPushToDriver(driver.driverId, 'New Ride Available!', `Pickup: ${ride.pickupAddress} → Dropoff: ${ride.dropoffAddress}`, {
                type: 'newRide',
                rideId: ride.id
              });
            } catch (pushError) {
              console.error(`Error sending push notification to driver ${driver.driverId}:`, pushError);
            }
            return; // Successfully assigned
          } else {
            console.log(`Global io not available for driver ${driver.driverId}`);
          }
        } else {
          console.log(`Driver ${driver.driverId} not connected in socket - cannot send ride offer`);
        }
      } catch (error) {
        console.error(`Error checking driver ${driver.driverId}:`, error);
        continue;
      }
    }

    console.log(`No available drivers found for ride ${ride.id} - checked ${availableDrivers.length} drivers`);
  } catch (error) {
    console.error('Error in auto-assign ride:', error);
  }
}

// Function to reassign a ride to another driver
async function reassignRide(rideId) {
  try {
    // Check if ride is still available
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true,
        status: true,
        driverId: true,
        pickupAddress: true,
        dropoffAddress: true,
        price: true,
        distanceKm: true,
        riderName: true,
        startLatLon: true,
        endLatLon: true,
        vehicleTypeId: true
      }
    });

    if (!ride || ride.status !== 'CONFIRMED' || ride.driverId) {
      console.log(`Ride ${rideId} is no longer available for reassignment`);
      return;
    }

    console.log(`Reassigning ride ${rideId} to another driver`);
    const vehicleInfo = await getAvailableVehiclesForRide(ride);
    if (vehicleInfo.length > 0) {
      await autoAssignRide(ride, vehicleInfo);
    } else {
      console.log(`No alternative drivers available for ride ${rideId}`);
    }
  } catch (error) {
    console.error(`Error reassigning ride ${rideId}:`, error);
  }
}

// Function to get rejection timeout based on available vehicles
async function getRejectionTimeoutMs(rideId) {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        startLatLon: true,
        vehicleTypeId: true
      }
    });

    if (!ride || !ride.startLatLon) return 120000; // Default 2 minutes

    const vehicleInfo = await getAvailableVehiclesForRide(ride);
    const availableCount = vehicleInfo.length;

    if (availableCount === 0) return 120000; // 2 minutes if no vehicles available
    if (availableCount === 1) return 60000; // 1 minute for 1 vehicle
    if (availableCount === 2) return 30000; // 30 seconds for 2 vehicles
    return 60000; // 1 minute for 3+ vehicles
  } catch (error) {
    console.error(`Error calculating rejection timeout for ride ${rideId}:`, error);
    return 120000; // Default 2 minutes
  }
}

// Function to calculate ETA for driver to pickup location
async function calculateETA(driverLocation, pickupLat, pickupLon) {
  if (!driverLocation || !pickupLat || !pickupLon) return null;

  const lat1 = driverLocation.lat;
  const lon1 = driverLocation.lng;
  const lat2 = pickupLat;
  const lon2 = pickupLon;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKmRaw = R * c;
  const timeMinutes = Math.ceil(distanceKmRaw * 2); // Assuming 30 km/h average speed

  return {
    distanceKm: Number(distanceKmRaw.toFixed(3)),
    distanceKmRaw,
    timeMinutes: timeMinutes,
    timeText: timeMinutes <= 1 ? 'Arriving now' : `${timeMinutes} min`
  };
}

async function maybeSendPickupProximity(rideId, driverId, driverLocation, startLatLon) {
  if (!rideId || !driverId || !driverLocation || !startLatLon) return;

  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true }
    });
    if (!ride || !['DISPATCHED', 'ONGOING', 'IN_PROGRESS'].includes(ride.status)) {
      return;
    }
  } catch (error) {
    console.error(`Error checking ride ${rideId} status for pickup proximity:`, error);
    return;
  }

  const eta = await calculateETA(driverLocation, startLatLon.lat, startLatLon.lon);
  if (!eta) return;

  const distanceMeters = Math.round((eta.distanceKmRaw ?? eta.distanceKm) * 1000);
  console.log(`Driver ${driverId} has a distance of ${distanceMeters} meters to the pickup location of ride ${rideId}`);

  if (distanceMeters < PICKUP_PROXIMITY_THRESHOLD_METERS) {
    const proximityKey = `${rideId}_${driverId}`;
    const io = global.io;

    if (!pickupProximitySent.has(proximityKey)) {
      const countdownStart = Date.now();

      if (io) {
        io.to(`driver_${driverId}`).emit('pickupProximity', {
          rideId,
          distanceMeters,
          countdownStart,
          countdownDuration: PICKUP_COUNTDOWN_DURATION_SEC
        });
        console.log(`Sent pickupProximity to driver ${driverId} for ride ${rideId}: ${distanceMeters} meters, countdown start: ${new Date(countdownStart).toISOString()}`);
      }

      pickupProximitySent.set(proximityKey, {
        driverId,
        sentAt: Date.now(),
        countdownStart,
        countdownDuration: PICKUP_COUNTDOWN_DURATION_SEC,
        distanceMeters,
        startLocation: {
          lat: startLatLon.lat,
          lng: startLatLon.lon
        },
        expiredAt: null
      });

      // Schedule pickupCountdownExpired event after 5 minutes
      setTimeout(() => {
        const driverSocket = connectedDrivers?.get(driverId);
        const activeIo = global.io;
        const existing = pickupProximitySent.get(proximityKey);
        if (!existing || existing.expiredAt) return;
        if (driverSocket && driverSocket.socketId && activeIo) {
          activeIo.to(`driver_${driverId}`).emit('pickupCountdownExpired', { rideId });
          console.log(`Sent pickupCountdownExpired to driver ${driverId} for ride ${rideId}`);
        }
        pickupProximitySent.set(proximityKey, {
          ...existing,
          expiredAt: Date.now()
        });
      }, PICKUP_COUNTDOWN_DURATION_SEC * 1000);
    } else {
      const proximityData = pickupProximitySent.get(proximityKey);
      if (proximityData && proximityData.countdownStart) {
        const duration = proximityData.countdownDuration || PICKUP_COUNTDOWN_DURATION_SEC;
        const elapsed = Math.floor((Date.now() - proximityData.countdownStart) / 1000);
        if (elapsed >= duration && !proximityData.expiredAt) {
          if (io) {
            io.to(`driver_${driverId}`).emit('pickupCountdownExpired', { rideId });
            console.log(`Sent pickupCountdownExpired (on proximity re-check) to driver ${driverId} for ride ${rideId}`);
          }
          pickupProximitySent.set(proximityKey, {
            ...proximityData,
            expiredAt: Date.now()
          });
        }
      }
    }
  }
}

// REMOVED: sendPushNotification function - Using only local notifications
// async function sendPushNotification(driverId, rideData) {
//   try {
//     const driver = await prisma.comDriver.findUnique({
//       where: { id: driverId },
//       select: { expoPushToken: true }
//     });

//     if (!driver || !driver.expoPushToken) {
//       console.log(`No push token for driver ${driverId}`);
//       return;
//     }

//     // Check if token is valid Expo push token
//     if (!Expo.isExpoPushToken(driver.expoPushToken)) {
//       console.log(`Invalid push token for driver ${driverId}: ${driver.expoPushToken}`);
//       return;
//     }

//     const expo = new Expo();
//     const message = {
//       to: driver.expoPushToken,
//       sound: 'default',
//       title: 'New Ride Available!',
//       body: `Pickup: ${rideData.pickupAddress} → Dropoff: ${rideData.dropoffAddress}`,
//       data: { type: 'newRide', rideId: rideData.id },
//       priority: 'high',
//     };

//     const ticket = await expo.sendPushNotificationsAsync([message]);
//     console.log(`Push notification sent to driver ${driverId}:`, ticket);
//   } catch (error) {
//     console.error(`Error sending push notification to driver ${driverId}:`, error);
//   }
// }

// Function to cleanup stale currentRideId assignments
async function cleanupStaleRideAssignments() {
  try {
    // Find drivers with currentRideId set but ride is not in active state
    const staleAssignments = await prisma.comDriver.findMany({
      where: {
        currentRideId: { not: null }
      },
      select: {
        id: true,
        currentRideId: true
      }
    });

    for (const driver of staleAssignments) {
      if (driver.currentRideId) {
        const ride = await prisma.ride.findUnique({
          where: { id: driver.currentRideId },
          select: {
            id: true,
            status: true,
            driverId: true
          }
        });

        // If ride doesn't exist, is completed/cancelled, or assigned to different driver
        if (!ride ||
            ['COMPLETED', 'CANCELED', 'REFUNDED'].includes(ride.status) ||
            (ride.driverId && ride.driverId !== driver.id)) {
          console.log(`Cleaning up stale currentRideId for driver ${driver.id} (ride ${driver.currentRideId})`);
          await prisma.comDriver.update({
            where: { id: driver.id },
            data: {
              currentRideId: null,
              isBusy: false,
              rideAccepted: 0
            }
          });

          // Clean up pickup proximity sent
          const proximityKey = `${driver.currentRideId}_${driver.id}`;
        if (global.pickupProximitySent.has(proximityKey)) {
          global.pickupProximitySent.delete(proximityKey);
          console.log(`Cleaned up pickup proximity for ride ${driver.currentRideId}, driver ${driver.id}`);
        }
        if (global.scheduledLateWarnings?.has?.(proximityKey)) {
          global.scheduledLateWarnings.delete(proximityKey);
        }
        }
      }
    }
  } catch (error) {
    console.error('Error in cleanupStaleRideAssignments:', error);
  }
}

// Function to check for new rides and log them
async function checkForNewRides() {
  try {
    // First, cleanup any stale assignments
    await cleanupStaleRideAssignments();

    // Cleanup scheduled offers if ride no longer valid
    if (scheduledOffers.size > 0) {
      for (const [offerRideId, offerState] of scheduledOffers.entries()) {
        const rideCheck = await prisma.ride.findUnique({
          where: { id: offerRideId },
          select: { id: true, status: true, driverId: true }
        });

        if (!rideCheck || rideCheck.status !== 'CONFIRMED' || rideCheck.driverId) {
          if (offerState?.timerId) {
            clearTimeout(offerState.timerId);
          }
          scheduledOffers.delete(offerRideId);
          const io = global.io;
          if (io && offerState?.candidates?.length) {
            offerState.candidates.forEach((candidate) => {
              io.to(`driver_${candidate.driverId}`).emit('rideCancelled', { rideId: offerRideId });
            });
          }
        }
      }
    }

    const now = new Date();
    const newRides = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED',
        paymentMethod: {
          not: null
        },
        OR: [
          {
            driverId: null,
            car: null
          },
          {
            scheduled: true,
            driverId: { not: null }
          }
        ]
      },
      select: {
        id: true,
        userId: true,
        status: true,
        pickupAddress: true,
        stopAddress: true,
        dropoffAddress: true,
        price: true,
        createdAt: true,
        distanceKm: true,
        durationMin: true,
        riderName: true,
        startLatLon: true,
        stopLatLon: true,
        endLatLon: true,
        vehicleTypeId: true,
        pickupTime: true,
        scheduled: true,
        paymentStatus: true,
        paymentRef: true,
        savedPaymentMethodId: true,
        savedPaymentMethod: true,
        driverId: true,
        car: true,
        driverQueue: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    for (const ride of newRides) {
      console.log(`A new ride detected, ride id: ${ride.id}, status: ${ride.status}`);

      // Check if ride is still valid (not cancelled)
      if (ride.status !== 'CONFIRMED') {
        console.log(`Ride ${ride.id} is no longer confirmed (status: ${ride.status}) - removing from active offers if present`);
        if (global.activeOffers.has(ride.id)) {
          const driverId = global.activeOffers.get(ride.id);
          // Notify the driver to clear the offer
          const io = global.io;
          if (io) {
            io.to(`driver_${driverId}`).emit('rideCancelled', { rideId: ride.id });
          }
          global.activeOffers.delete(ride.id);
        }
        continue;
      }

      const minutesToPickup = getMinutesUntilPickup(ride.pickupTime, now);
      let scheduledDispatchLeadMinutes = SCHEDULED_IMMEDIATE_WINDOW_MINUTES;

      if (ride.scheduled) {
        if (minutesToPickup !== null && minutesToPickup <= 0) {
          console.log(`Scheduled ride ${ride.id} expired (${minutesToPickup} min) - canceling`);
          await cancelRideWithRefund(ride, { reason: 'Scheduled pickup time has passed' });
          continue;
        }

        if (minutesToPickup !== null) {
          scheduledDispatchLeadMinutes = await getScheduledDispatchLeadMinutes(ride);
        }

        if (minutesToPickup !== null && minutesToPickup > scheduledDispatchLeadMinutes) {
          if (scheduledOffers.has(ride.id)) {
            continue;
          }

          if (!ride.driverId) {
            const assigned = await assignScheduledRideFromQueue(ride);
            if (assigned) {
              const updatedRide = await prisma.ride.findUnique({
                where: { id: ride.id },
                select: {
                  id: true,
                  driverId: true,
                  car: true,
                  driverQueue: true,
                  status: true,
                  pickupAddress: true,
                  stopAddress: true,
                  dropoffAddress: true,
                  price: true,
                  distanceKm: true,
                  riderName: true,
                  startLatLon: true,
                  stopLatLon: true,
                  endLatLon: true,
                  vehicleTypeId: true,
                  pickupTime: true
                }
              });
              if (updatedRide) {
                ride.driverId = updatedRide.driverId;
                ride.car = updatedRide.car;
                ride.driverQueue = updatedRide.driverQueue;
              }
            }
          }

          if (!ride.driverId) {
            await broadcastScheduledRideOffer(ride);
          }
          continue;
        }

        clearScheduledOfferState(ride.id, 'Scheduled ride dispatching');

        if (ride.driverId) {
          const dispatched = await dispatchScheduledRide(ride, minutesToPickup);
          if (dispatched) {
            continue;
          }

          await prisma.ride.update({
            where: { id: ride.id },
            data: { driverId: null, car: null }
          });
          ride.driverId = null;
          ride.car = null;
        }

        if (ride.scheduled && minutesToPickup !== null && minutesToPickup <= scheduledDispatchLeadMinutes) {
          // If we have queued acceptances, refresh driverId before fallback assignment
          if (!ride.driverId && normalizeDriverQueue(ride.driverQueue).length > 0) {
            const reassigned = await assignScheduledRideFromQueue(ride);
            if (reassigned) {
              const updatedRide = await prisma.ride.findUnique({
                where: { id: ride.id },
                select: { driverId: true, car: true, driverQueue: true }
              });
              if (updatedRide) {
                ride.driverId = updatedRide.driverId;
                ride.car = updatedRide.car;
                ride.driverQueue = updatedRide.driverQueue;
              }
            }
          }
        }
      }

      // Check if this ride has an active offer or has been offered to any driver
      if (global.activeOffers.has(ride.id)) {
        console.log(`Ride ${ride.id} has active offer to driver: ${global.activeOffers.get(ride.id)} - skipping`);
        continue;
      }

      const driverWithRide = await prisma.comDriver.findFirst({
        where: {
          currentRideId: ride.id
        },
        select: {
          id: true
        }
      });

      if (driverWithRide) {
        console.log(`Ride ${ride.id} has been offered to driver: ${driverWithRide.id}`);
      } else {
        console.log(`Ride ${ride.id} has not been offered to any driver yet`);
        // Check if this ride was rejected by any driver
        const rejectedDrivers = global.rejectedRides?.get(ride.id);
        if (rejectedDrivers && rejectedDrivers.size > 0) {
          console.log(`Ride ${ride.id} was rejected by drivers: ${Array.from(rejectedDrivers).join(', ')}`);
          // Skip this ride for now to avoid re-offering to rejected drivers
          continue;
        }

        // Additional check: verify no driver is currently busy with this ride
        const busyDriver = await prisma.comDriver.findFirst({
          where: {
            currentRideId: ride.id,
            isBusy: true
          },
          select: { id: true }
        });

        if (busyDriver) {
          console.log(`Ride ${ride.id} is currently assigned to busy driver: ${busyDriver.id}`);
          continue;
        }
        // Get available vehicles for this ride
        try {
          const vehicleInfo = await getAvailableVehiclesForRide(ride);
          if (vehicleInfo.length > 0) {
            console.log(`Ride ${ride.id} will get one of these: ${vehicleInfo.join(', ')}`);
            // Auto-assign the ride to the closest available driver
            await autoAssignRide(ride, vehicleInfo);
          } else {
            if (ride.scheduled && minutesToPickup !== null && minutesToPickup <= scheduledDispatchLeadMinutes) {
              console.log(`No vehicles available for scheduled ride ${ride.id} (${minutesToPickup} min) - canceling`);
              await cancelRideWithRefund(ride, { reason: 'No vehicles available for scheduled ride' });
            } else {
              console.log(`Ride ${ride.id} has not been offered to any driver yet (no vehicles available)`);
            }
          }
        } catch (error) {
          console.error(`Error getting available vehicles for ride ${ride.id}:`, error);
          console.log(`Ride ${ride.id} has not been offered to any driver yet`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking for new rides:', error);
  }
}

// Function to check ongoing rides distances
async function checkScheduledLateWarnings() {
  try {
    const now = new Date();
    const scheduledRides = await prisma.ride.findMany({
      where: {
        scheduled: true,
        driverId: { not: null },
        pickupTime: { not: null },
        status: { in: ['CONFIRMED', 'DISPATCHED', 'ONGOING', 'IN_PROGRESS'] }
      },
      select: {
        id: true,
        driverId: true,
        pickupTime: true,
        startLatLon: true,
        status: true,
        driverQueue: true,
        vehicleTypeId: true
      }
    });

    const activeKeys = new Set(
      scheduledRides
        .filter((ride) => ride.driverId)
        .map((ride) => `${ride.id}_${ride.driverId}`)
    );

    for (const key of scheduledLateWarnings.keys()) {
      if (!activeKeys.has(key)) {
        scheduledLateWarnings.delete(key);
      }
    }

    const activeRideIds = new Set(scheduledRides.map((ride) => ride.id));
    for (const [rideId] of scheduledLateReassignments.entries()) {
      if (!activeRideIds.has(rideId)) {
        scheduledLateReassignments.delete(rideId);
      }
    }

    for (const ride of scheduledRides) {
      const driverId = ride.driverId;
      if (!driverId || !ride.startLatLon) continue;

      const warningKey = `${ride.id}_${driverId}`;
      const proximityKey = `${ride.id}_${driverId}`;

      if (!connectedDrivers?.has?.(driverId)) {
        continue;
      }

      const driverLocation = await resolveDriverLocation(driverId);
      if (!driverLocation) continue;

      const eta = await calculateETA(driverLocation, ride.startLatLon.lat, ride.startLatLon.lon);
      if (!eta) continue;

      const distanceMeters = Math.round((eta.distanceKmRaw ?? eta.distanceKm) * 1000);
      if (distanceMeters < PICKUP_PROXIMITY_THRESHOLD_METERS) {
        scheduledLateWarnings.delete(warningKey);
        continue;
      }

      if (pickupProximitySent.has(proximityKey)) {
        scheduledLateWarnings.delete(warningKey);
        continue;
      }

      const minutesToPickup = getMinutesUntilPickup(ride.pickupTime, now);
      if (minutesToPickup === null) {
        scheduledLateWarnings.delete(warningKey);
        continue;
      }

      const minutesBeforePickup = minutesToPickup - eta.timeMinutes;
      if (minutesBeforePickup >= SCHEDULED_LATE_BUFFER_MINUTES) {
        scheduledLateWarnings.delete(warningKey);
        continue;
      }

      if (minutesBeforePickup <= -SCHEDULED_LATE_REASSIGN_THRESHOLD_MINUTES) {
        const reassignState = scheduledLateReassignments.get(ride.id);
        if (!reassignState || reassignState.status === 'no_candidates') {
          const candidates = await buildScheduledCandidates(ride);
          const reassigned = await reassignScheduledRideDueToLate(ride, driverId, candidates);
          if (reassigned) {
            scheduledLateWarnings.delete(warningKey);
          }
        }
        continue;
      }

      const stage = getScheduledLateStage(minutesBeforePickup);
      if (!stage) continue;

      const previous = scheduledLateWarnings.get(warningKey);
      const lastStage = previous?.lastStage || 0;
      if (stage <= lastStage) continue;

      const remainingMinutes = Math.max(0, SCHEDULED_LATE_MAX_STAGE - stage);
      const io = global.io;
      if (io) {
        io.to(`driver_${driverId}`).emit('scheduledLateWarning', {
          rideId: ride.id,
          lateMinutes: stage,
          remainingMinutes,
          etaMinutes: eta.timeMinutes,
          minutesBeforePickup: Number(minutesBeforePickup.toFixed(2)),
          pickupTime: ride.pickupTime
        });
      }

      scheduledLateWarnings.set(warningKey, {
        lastStage: stage,
        lastSentAt: Date.now()
      });
    }
  } catch (error) {
    console.error('Error in checkScheduledLateWarnings:', error);
  }
}

// Function to check ongoing rides distances
async function checkOngoingRidesDistances() {
  try {
    const ongoingRides = await prisma.ride.findMany({
      where: {
        status: 'ONGOING',
        driverId: { not: null }
      },
      select: {
        id: true,
        driverId: true,
        startLatLon: true
      }
    });

    for (const ride of ongoingRides) {
      const driverId = ride.driverId;
      const rideId = ride.id;
      const startLatLon = ride.startLatLon;

      if (!driverId || !startLatLon) continue;

      // Get driver location
      let driverLocation = null;
      const connectedDriver = connectedDrivers?.get(driverId);
      if (connectedDriver && connectedDriver.location) {
        driverLocation = connectedDriver.location;
      } else {
        // Get from database
        const driver = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: { lastLocation: true }
        });

        if (driver && driver.lastLocation && Array.isArray(driver.lastLocation)) {
          driverLocation = { lat: driver.lastLocation[0], lng: driver.lastLocation[1] };
        }
      }

    if (driverLocation) {
      await maybeSendPickupProximity(rideId, driverId, driverLocation, startLatLon);
    }
    }
  } catch (error) {
    console.error('Error in checkOngoingRidesDistances:', error);
  }
}

// Make functions globally available
global.checkForNewRides = checkForNewRides;
global.checkOngoingRidesDistances = checkOngoingRidesDistances;
global.checkScheduledLateWarnings = checkScheduledLateWarnings;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);
  setSocketServer(io);

  // Initialize driver status monitor
  const driverStatusMonitor = new DriverStatusMonitor(io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', async (data) => {
      // Verify token if provided
      if (socket.handshake.auth && socket.handshake.auth.token) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(socket.handshake.auth.token, SOCKET_JWT_SECRET);
          if (!decoded.driverId || decoded.driverId !== data.driverId) {
            console.log('Invalid token for driver join');
            socket.disconnect();
            return;
          }
        } catch (error) {
          console.log('Token verification failed for driver join:', error.message);
          socket.disconnect();
          return;
        }
      } else {
        console.log('No token provided for driver join');
        socket.disconnect();
        return;
      }

      if (data.driverId && data.vehicleTypeId) {
        socket.join(`driver_${data.driverId}`);
        console.log(`Driver ${data.driverId} joined room with vehicle type ${data.vehicleTypeId}`);

        // Add to connected drivers
        connectedDrivers.set(data.driverId, {
          socketId: socket.id,
          location: data.location || null,
          lastUpdate: Date.now(),
          vehicleTypeId: data.vehicleTypeId
        });

        console.log(`Connected drivers now: ${Array.from(connectedDrivers.keys()).join(', ')}`);

        // Update driver status in database once
        try {
          await prisma.comDriver.update({
            where: { id: data.driverId },
            data: { isOnline: true, isBusy: false }
          });
          console.log(`Driver ${data.driverId} status updated to online`);
        } catch (error) {
          console.error('Error updating driver status:', error);
        }

        // Check if driver has an ongoing ride with expired pickup countdown
        try {
          const driver = await prisma.comDriver.findUnique({
            where: { id: data.driverId },
            select: { currentRideId: true }
          });

          if (driver && driver.currentRideId) {
            const ride = await prisma.ride.findUnique({
              where: { id: driver.currentRideId },
              select: { id: true, status: true, driverId: true }
            });

            if (ride && (ride.status === 'ONGOING' || ride.status === 'DISPATCHED')) {
              const proximityKey = `${ride.id}_${data.driverId}`;
              if (pickupProximitySent.has(proximityKey)) {
                const proximityData = pickupProximitySent.get(proximityKey);
                if (proximityData && proximityData.countdownStart) {
                  const duration = proximityData.countdownDuration || PICKUP_COUNTDOWN_DURATION_SEC;
                  const elapsed = Math.floor((Date.now() - proximityData.countdownStart) / 1000);
                  if (elapsed >= duration) {
                    // Countdown already expired, send expired event
                    socket.emit('pickupCountdownExpired', { rideId: ride.id });
                    console.log(`Sent pickupCountdownExpired on reconnect to driver ${data.driverId} for ride ${ride.id}`);
                  } else {
                    socket.emit('pickupProximity', {
                      rideId: ride.id,
                      distanceMeters: proximityData.distanceMeters ?? 0,
                      countdownStart: proximityData.countdownStart,
                      countdownDuration: duration
                    });
                    console.log(`Re-sent pickupProximity on reconnect to driver ${data.driverId} for ride ${ride.id}`);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error checking pickup countdown status on reconnect:', error);
        }
      }
    });

    socket.on('updateLocation', async (data) => {
      if (data.driverId && connectedDrivers.has(data.driverId)) {
        connectedDrivers.get(data.driverId).location = data.location;
        connectedDrivers.get(data.driverId).lastUpdate = Date.now();
        console.log(`Driver ${data.driverId} location updated:`, data.location);

        // Update database
        try {
          // Find the vehicle assigned to this driver
          const driver = await prisma.comDriver.findUnique({
            where: { id: data.driverId },
            select: { car: true, currentRideId: true }
          });

          if (driver && driver.car) {
            const vehicle = await prisma.comVehicles.findFirst({
              where: { regNumber: driver.car }
            });

            if (vehicle) {
              // Update vehicle location
              await prisma.comVehicles.update({
                where: { id: vehicle.id },
                data: {
                  lastLat: data.location.lat,
                  lastLon: data.location.lng,
                  lastLocationUpdate: new Date()
                }
              });

              // Also update driver's lastLocation
              await prisma.comDriver.update({
                where: { id: data.driverId },
                data: {
                  lastLocation: [data.location.lat, data.location.lng]
                }
              });

              // Notify passenger of location update and driver info if driver has active ride
              if (driver.currentRideId) {
                // Get ride details for ETA calculation
                const ride = await prisma.ride.findUnique({
                  where: { id: driver.currentRideId },
                  select: { startLatLon: true, status: true }
                });

                let eta = null;
            if (ride && ride.startLatLon && (ride.status === 'ONGOING' || ride.status === 'IN_PROGRESS' || ride.status === 'DISPATCHED')) {
              eta = await calculateETA(data.location, ride.startLatLon.lat, ride.startLatLon.lon);
            }

                // Get driver info
                const driverInfo = await prisma.comDriver.findUnique({
                  where: { id: data.driverId },
                  select: {
                    id: true,
                    drFname: true,
                    drLname: true,
                    car: true
                  }
                });

            io.to(`booking_${driver.currentRideId}`).emit('driverInfoUpdate', {
              bookingId: driver.currentRideId,
              driverId: data.driverId,
              driver: driverInfo,
              location: data.location,
              eta: eta,
              timestamp: new Date().toISOString()
            });

            if (ride && ride.startLatLon && (ride.status === 'ONGOING' || ride.status === 'DISPATCHED')) {
              await maybeSendPickupProximity(driver.currentRideId, data.driverId, data.location, ride.startLatLon);
            }
          }
            }
          }
        } catch (error) {
          console.error('Error updating location in database:', error);
        }
      }
    });

    socket.on('acceptRide', async (data) => {
      try {
        console.log(`Driver ${data.driverId} accepted ride ${data.rideId}`);

        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          const candidate = scheduledOffer.candidates.find((c) => c.driverId === data.driverId);
          if (!candidate) {
            socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Driver not eligible for scheduled ride' });
            return;
          }

          scheduledOffer.accepted.set(data.driverId, {
            driverId: data.driverId,
            distanceKm: candidate.distanceKm,
            etaMinutes: candidate.etaMinutes,
            rating: candidate.rating,
            vehicleTypeId: candidate.vehicleTypeId,
            car: candidate.car,
            chainPriority: Boolean(candidate.chainPriority),
            chainGapMinutes: candidate.chainGapMinutes ?? null,
            chainEtaMinutes: candidate.chainEtaMinutes ?? null
          });

          try {
            const existingQueue = await prisma.ride.findUnique({
              where: { id: data.rideId },
              select: { driverQueue: true }
            });
            const queueIds = normalizeDriverQueue(existingQueue?.driverQueue);
            if (!queueIds.includes(data.driverId)) {
              queueIds.push(data.driverId);
              await prisma.ride.update({
                where: { id: data.rideId },
                data: { driverQueue: queueIds }
              });
            }
          } catch (error) {
            console.error(`Failed to persist scheduled acceptance for ride ${data.rideId}:`, error);
          }

          socket.emit('scheduledOfferAcknowledged', { rideId: data.rideId });
          return;
        }

        // Check if ride is still available
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          include: { vehicleType: true }
        });

        if (!ride || ride.driverId || ride.status !== 'CONFIRMED') {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Ride not available' });
          return;
        }

        if (global.activeOffers.has(data.rideId) && global.activeOffers.get(data.rideId) !== data.driverId) {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Ride already offered to another driver' });
          return;
        }

        // Get driver info
        const driver = await prisma.comDriver.findUnique({
          where: { id: data.driverId },
          include: {
            company: true,
            shifts: true
          }
        });

        if (!driver) {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Driver not found' });
          return;
        }

        if (!ride.scheduled) {
          let driverPickupEtaMinutes = 0;
          const driverLocation = await resolveDriverLocation(data.driverId);
          if (driverLocation && ride.startLatLon) {
            const eta = await calculateETA(driverLocation, ride.startLatLon.lat, ride.startLatLon.lon);
            if (eta && Number.isFinite(eta.timeMinutes)) {
              driverPickupEtaMinutes = eta.timeMinutes;
            }
          }

          const scheduledCheck = await canDriverAcceptImmediateRide(
            data.driverId,
            ride,
            driverPickupEtaMinutes,
            new Date()
          );
          if (!scheduledCheck.ok) {
            socket.emit('rideAcceptFailed', {
              rideId: data.rideId,
              reason: 'Cannot accept ride due to upcoming scheduled ride'
            });
            return;
          }
        }

        // Assign ride to driver
        await prisma.ride.update({
          where: { id: data.rideId },
          data: {
            driverId: data.driverId,
            car: driver.car || null,
            status: 'DISPATCHED',
            acceptedAt: new Date()
          }
        });

        // Update driver status
        await prisma.comDriver.update({
          where: { id: data.driverId },
          data: {
            currentRideId: data.rideId,
            rideAccepted: 1,
            isBusy: true
          }
        });

        // Clear active offer
        global.activeOffers.delete(data.rideId);

        // Clear pickup proximity sent
        const proximityKey = `${data.rideId}_${data.driverId}`;
        if (global.pickupProximitySent.has(proximityKey)) {
          global.pickupProximitySent.delete(proximityKey);
          console.log(`Cleared pickup proximity for accepted ride ${data.rideId}, driver ${data.driverId}`);
        }
        if (global.scheduledLateWarnings?.has?.(proximityKey)) {
          global.scheduledLateWarnings.delete(proximityKey);
        }

        // Notify driver of success
        socket.emit('rideAccepted', { rideId: data.rideId });

        // Notify driver app of status update
        socket.emit('driverStatusUpdate', {
          currentRideId: data.rideId,
          isBusy: true,
          rideAccepted: 1
        });

        // Notify driver of ride update
        socket.emit('ride-update', {
          rideId: data.rideId,
          status: 'DISPATCHED',
          timestamp: new Date().toISOString()
        });

        // Notify passenger of booking update
        io.to(`booking_${data.rideId}`).emit('bookingUpdate', {
          bookingId: data.rideId,
          status: 'DISPATCHED',
          driverId: data.driverId,
          driver: driver,
          timestamp: new Date().toISOString()
        });

        // Send initial driver info update
        const driverInfo = await prisma.comDriver.findUnique({
          where: { id: data.driverId },
          select: {
            id: true,
            drFname: true,
            drLname: true,
            car: true
          }
        });

        io.to(`booking_${data.rideId}`).emit('driverInfoUpdate', {
          bookingId: data.rideId,
          driverId: data.driverId,
          driver: driverInfo,
          location: null,
          eta: null,
          timestamp: new Date().toISOString()
        });

        // Also send SSE update
        realtimeService.sendBookingUpdate(data.rideId, {
          bookingId: data.rideId,
          status: 'DISPATCHED',
          driverId: data.driverId,
          driver: driver,
          timestamp: new Date().toISOString()
        });

        console.log(`Ride ${data.rideId} assigned to driver ${data.driverId}`);

      } catch (error) {
        console.error('Error accepting ride:', error);
        socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Server error' });
      }
    });

    socket.on('rejectRide', async (data) => {
      console.log(`Driver ${data.driverId} rejected ride ${data.rideId}`);
      try {
        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          scheduledOffer.rejected.add(data.driverId);
          socket.emit('rideOfferRejected', { rideId: data.rideId });
          return;
        }
        // Clear currentRideId and ban driver for 2 minutes
        const proposedBannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
        const bannedUntil = await getMergedBanUntil(data.driverId, proposedBannedUntil);
        await prisma.comDriver.update({
          where: { id: data.driverId },
          data: {
            currentRideId: null,
            bannedUntil,
            rideAccepted: 0,
            isBusy: false
          }
        });
        console.log(`Banned driver ${data.driverId} until ${bannedUntil} after ride rejection`);

        // Send status update to driver app
        socket.emit('driverStatusUpdate', {
          currentRideId: null,
          bannedUntil: bannedUntil.toISOString(),
          rideAccepted: null
        });

        // Auto-unban after 2 minutes (if no longer banned)
        scheduleAutoUnban(data.driverId, 120000);
      } catch (error) {
        console.error(`Error updating driver ${data.driverId} after rejection:`, error);
      }

      // Add to rejected rides to avoid re-offering
      if (!global.rejectedRides.has(data.rideId)) {
        global.rejectedRides.set(data.rideId, new Set());
      }
      global.rejectedRides.get(data.rideId).add(data.driverId);

      // Set timeout to remove rejection after 30 seconds for each driver
      const timeoutMs = 30000; // 30 seconds
      setTimeout(() => {
        if (global.rejectedRides.has(data.rideId)) {
          global.rejectedRides.get(data.rideId).delete(data.driverId);
          if (global.rejectedRides.get(data.rideId).size === 0) {
            global.rejectedRides.delete(data.rideId);
          }
        }
      }, timeoutMs);

      // Clear active offer
      global.activeOffers.delete(data.rideId);

      // Clear pickup proximity sent
      const proximityKey = `${data.rideId}_${data.driverId}`;
      if (global.pickupProximitySent.has(proximityKey)) {
        global.pickupProximitySent.delete(proximityKey);
        console.log(`Cleared pickup proximity for rejected ride ${data.rideId}, driver ${data.driverId}`);
      }
      if (global.scheduledLateWarnings?.has?.(proximityKey)) {
        global.scheduledLateWarnings.delete(proximityKey);
      }
      if (global.scheduledLateReassignments?.has?.(data.rideId)) {
        global.scheduledLateReassignments.delete(data.rideId);
      }

      // Send rejection confirmation to clear offer on client side
      socket.emit('rideOfferRejected', {
        rideId: data.rideId
      });

      // Try to reassign to another driver
      setTimeout(() => reassignRide(data.rideId), 1000);
    });

    socket.on('rideTimeout', async (data) => {
      console.log(`Driver ${data.driverId} timed out on ride ${data.rideId}`);
      try {
        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          scheduledOffer.rejected.add(data.driverId);
          socket.emit('rideOfferTimeout', { rideId: data.rideId });
          return;
        }
        // Reset driver status and ban for 2 minutes
        const proposedBannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
        const bannedUntil = await getMergedBanUntil(data.driverId, proposedBannedUntil);
        await prisma.comDriver.update({
          where: { id: data.driverId },
          data: {
            currentRideId: null,
            bannedUntil,
            isBusy: false
          }
        });

        // Add to rejected rides to avoid re-offering
        if (!global.rejectedRides.has(data.rideId)) {
          global.rejectedRides.set(data.rideId, new Set());
        }
        global.rejectedRides.get(data.rideId).add(data.driverId);

        // Set timeout to remove rejection after 30 seconds
        const timeoutMs = 30000; // 30 seconds
        setTimeout(() => {
          if (global.rejectedRides.has(data.rideId)) {
            global.rejectedRides.get(data.rideId).delete(data.driverId);
            if (global.rejectedRides.get(data.rideId).size === 0) {
              global.rejectedRides.delete(data.rideId);
            }
          }
        }, timeoutMs);

        // Send status update to driver app
        socket.emit('driverStatusUpdate', {
          currentRideId: null,
          bannedUntil: bannedUntil.toISOString(),
          rideAccepted: null
        });

        // Clear active offer
        global.activeOffers.delete(data.rideId);

        // Clear pickup proximity sent
        const proximityKey = `${data.rideId}_${data.driverId}`;
        if (global.pickupProximitySent.has(proximityKey)) {
          global.pickupProximitySent.delete(proximityKey);
          console.log(`Cleared pickup proximity for timed out ride ${data.rideId}, driver ${data.driverId}`);
        }
        if (global.scheduledLateWarnings?.has?.(proximityKey)) {
          global.scheduledLateWarnings.delete(proximityKey);
        }
        if (global.scheduledLateReassignments?.has?.(data.rideId)) {
          global.scheduledLateReassignments.delete(data.rideId);
        }

        // Send timeout event to stop the sound and clear offer
        socket.emit('rideOfferTimeout', {
          rideId: data.rideId
        });

        console.log(`Driver ${data.driverId} banned until ${bannedUntil} after ride timeout`);

        // Auto-unban after 2 minutes (if no longer banned)
        scheduleAutoUnban(data.driverId, 120000);

        // Try to reassign to another driver
        setTimeout(() => reassignRide(data.rideId), 1000);
      } catch (error) {
        console.error('Error resetting driver status after timeout:', error);
      }
    });

    // Chat functionality
    socket.on('joinChat', (data) => {
      if (data.bookingId) {
        socket.join(`chat_${data.bookingId}`);
        console.log(`User joined chat for booking ${data.bookingId}`);
      }
    });

    // Booking updates functionality
    socket.on('joinBooking', (data) => {
      if (data.bookingId) {
        socket.join(`booking_${data.bookingId}`);
        console.log(`User joined booking updates for booking ${data.bookingId}`);
      }
    });

    socket.on('sendMessage', (data) => {
      if (data.bookingId && data.message && data.sender) {
        const messageData = {
          message: data.message,
          sender: data.sender,
          timestamp: new Date().toISOString()
        };
        // Broadcast to all in the chat room including sender
        io.to(`chat_${data.bookingId}`).emit('newMessage', messageData);
        console.log(`Message sent in chat ${data.bookingId} by ${data.sender}`);
      }
    });

    socket.on('disconnect', () => {
      // Remove from connected drivers
      for (const [driverId, driverData] of connectedDrivers.entries()) {
        if (driverData.socketId === socket.id) {
          connectedDrivers.delete(driverId);
          console.log(`Driver ${driverId} disconnected`);
          console.log(`Connected drivers now: ${Array.from(connectedDrivers.keys()).join(', ')}`);

          const clearedRideIds = [];
          if (global.activeOffers?.size) {
            for (const [rideId, activeDriverId] of global.activeOffers.entries()) {
              if (activeDriverId === driverId) {
                global.activeOffers.delete(rideId);
                clearedRideIds.push(rideId);
              }
            }
          }

          if (clearedRideIds.length) {
            console.log(`Cleared active offers for disconnected driver ${driverId}: ${clearedRideIds.join(', ')}`);
            clearedRideIds.forEach((rideId) => {
              setTimeout(() => reassignRide(rideId), 1000);
            });
          }

          try {
          const warningKeys = Array.from(scheduledLateWarnings.keys());
          warningKeys.forEach((key) => {
            if (key.endsWith(`_${driverId}`)) {
              scheduledLateWarnings.delete(key);
            }
          });
          const reassignmentKeys = Array.from(scheduledLateReassignments.keys());
          reassignmentKeys.forEach((rideId) => {
            const reassignment = scheduledLateReassignments.get(rideId);
            if (reassignment?.driverId === driverId) {
              scheduledLateReassignments.delete(rideId);
            }
          });
        } catch (error) {
          console.error('Error clearing scheduled late warnings on disconnect:', error);
        }

          // Update driver status in database
          prisma.comDriver.update({
            where: { id: driverId },
            data: { isOnline: false }
          }).catch(error => console.error('Error updating driver offline status:', error));
          break;
        }
      }
    });
  });

  // Make io available globally for the robot
  global.io = io;

  server.listen(3000, async (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');

    // Start driver status monitor
    driverStatusMonitor.start();

    // Check for existing new rides on server start
    setTimeout(() => {
      if (global.checkForNewRides) {
        global.checkForNewRides();
      }
    }, 2000); // Wait 2 seconds for database connection

    // Check for new rides every 12 seconds
    setInterval(() => {
      if (global.checkForNewRides) {
        global.checkForNewRides();
      }
    }, 12000);

    // Check ongoing rides distances every 30 seconds
    setInterval(() => {
      if (global.checkOngoingRidesDistances) {
        global.checkOngoingRidesDistances();
      }
    }, 30000);

    // Check scheduled ride late warnings every 20 seconds
    setInterval(() => {
      if (global.checkScheduledLateWarnings) {
        global.checkScheduledLateWarnings();
      }
    }, 20000);
  });
});
