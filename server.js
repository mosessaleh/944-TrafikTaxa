const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');
const { setSocketServer } = require('./lib/socket-server');
const { connectedDrivers } = require('./lib/connected-drivers');
const realtimeService = require('./lib/realtime-service');
const DriverStatusMonitor = require('./lib/driver-status-monitor');
const { sendPushToDriver } = require('./lib/notification-service');
const { sendEmail } = require('./lib/email');
const { chargeCancellationFee } = require('./lib/payment-processor');
const {
  ensureDriverScheduleTables,
  canDriverReceiveRide,
  invalidateDriverScheduleCache
} = require('./lib/driver-schedule');
const Holidays = require('date-holidays');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

function resolveSocketJwtSecret() {
  const configuredSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET/JWT_SECRET env var is required in production and must be at least 32 characters');
  }

  const ephemeralSecret = randomBytes(48).toString('hex');
  console.warn('⚠️ AUTH_SECRET/JWT_SECRET is missing or too short. Using an ephemeral development socket secret for this process only.');
  return ephemeralSecret;
}

const SOCKET_JWT_SECRET = resolveSocketJwtSecret();

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

function canStartPickupCountdown(ride) {
  if (!ride?.scheduled || !ride?.pickupTime) return true;
  const now = Date.now();
  const scheduledTs = new Date(ride.pickupTime).getTime();
  return now >= scheduledTs;
}

function clearPickupProximity(rideId, driverId, reason) {
  const proximityKey = `${rideId}_${driverId}`;
  const existing = pickupProximitySent.get(proximityKey);
  if (existing?.timeoutId) {
    clearTimeout(existing.timeoutId);
  }
  if (pickupProximitySent.has(proximityKey)) {
    pickupProximitySent.delete(proximityKey);
    if (reason) {
      console.log(`Cleared pickup proximity for ride ${rideId}, driver ${driverId} (${reason})`);
    }
  }
}

// التحقق من صلاحية الانضمام لغرف الحجز/الدردشة بناءً على التوكن (راكب أو سائق مالك للحجز)
async function canAccessBooking(bookingId, socket) {
  const normalizedId = Number(bookingId);
  if (!normalizedId) return false;

  const decodedUserId = socket?.data?.userId;
  const decodedDriverId = socket?.data?.driverId;

  try {
    const ride = await prisma.ride.findUnique({
      where: { id: normalizedId },
      select: { id: true, userId: true, driverId: true }
    });

    if (!ride) return false;
    if (decodedUserId && ride.userId === decodedUserId) return true;
    if (decodedDriverId && ride.driverId === decodedDriverId) return true;
    return false;
  } catch (error) {
    console.error('Error verifying booking access:', error);
    return false;
  }
}

const PICKUP_PROXIMITY_THRESHOLD_METERS = 30;
const PICKUP_COUNTDOWN_DURATION_SEC = 300;

// Scheduled ride offers (upcoming inbox + push notifications)
const scheduledOffers = new Map(); // rideId -> offer state
const scheduledOfferCooldowns = new Map(); // rideId -> next timestamp allowed for rebroadcast
global.scheduledOffers = scheduledOffers;
global.scheduledOfferCooldowns = scheduledOfferCooldowns;
const SCHEDULED_OFFER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const SCHEDULED_OFFER_WINDOW_MINUTES = 60;
const SCHEDULED_STAGE2_MAX_WINDOW_MINUTES = 24 * 60;
const SCHEDULED_STAGE2_OFFER_TIMEOUT_MS = 3 * 60 * 1000;
const SCHEDULED_STAGE2_MAX_ETA_MINUTES = 20;
const SCHEDULED_STAGE3_OFFER_TIMEOUT_MS = 10 * 60 * 1000;
const IMMEDIATE_MAX_PICKUP_ETA_MINUTES = 45;
const SCHEDULED_STAGE3_POSTAL_PREFIX_LEN = 4;
const SCHEDULED_STAGE3_FALLBACK_DISTANCE_PENALTY = 9999;
const SCHEDULED_MAX_ETA_MINUTES = 30;
const SCHEDULED_CONFLICT_WINDOW_HOURS = 6;
const SCHEDULED_IMMEDIATE_WINDOW_MINUTES = 15;
const SCHEDULED_CHAIN_MAX_GAP_MINUTES = 30;
const SCHEDULED_CHAIN_MAX_TRAVEL_MINUTES = 25; // حد أقصى زمن انتقال بين نهاية الرحلة الحالية وبداية المؤجلة التالية (دقائق)
const SCHEDULED_PICKUP_BUFFER_MINUTES = 7;
const SCHEDULED_LATE_BUFFER_MINUTES = SCHEDULED_PICKUP_BUFFER_MINUTES;
const SCHEDULED_LATE_MAX_STAGE = Math.max(1, SCHEDULED_LATE_BUFFER_MINUTES - 1);
const SCHEDULED_LATE_REASSIGN_THRESHOLD_MINUTES = 3;
const SCHEDULED_LATE_PENALTY_MINUTES = 5;
const SCHEDULED_LATE_RATING_PENALTY = 0.01;
const DRIVER_BAN_RESTRICT_OFFERS_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const SHIFT_WARNING_THRESHOLD_HOURS = 11;
const SHIFT_ENFORCEMENT_GRACE_HOURS = 1;
const SHIFT_SUSPENSION_DAYS = 3;

function isDriverOfferRestrictedByBan(bannedUntil, now = new Date()) {
  if (!bannedUntil) return false;
  const banDate = new Date(bannedUntil);
  if (Number.isNaN(banDate.getTime())) return false;
  if (banDate <= now) return false;
  const remainingMs = banDate.getTime() - now.getTime();
  return remainingMs <= DRIVER_BAN_RESTRICT_OFFERS_THRESHOLD_MS;
}

const SCHEDULED_STAGE2_RATE_THRESHOLDS = {
  1: { day: 400, night: 500, holiday: 600 }, // Sedan
  2: { day: 450, night: 550, holiday: 650 }, // 7-seat
  3: { day: 600, night: 650, holiday: 750 }, // Van
  4: { day: 750, night: 850, holiday: 900 } // Limo
};

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

function getEtaWindowKey(timeMinutes) {
  if (!Number.isFinite(timeMinutes)) return 'unknown';
  if (timeMinutes <= 5) return '0-5';
  if (timeMinutes <= 10) return '5-10';
  if (timeMinutes <= 20) return '10-20';
  return '20+';
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
    pickupTime: ride.pickupTime,
    paymentMethod: ride.paymentMethod
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

function getScheduledOfferExpiryMs(offerState) {
  if (!offerState) return Date.now();
  return Number(offerState.createdAt || Date.now()) + Number(offerState.timeoutMs || SCHEDULED_OFFER_TIMEOUT_MS);
}

function getScheduledOfferIsEligibleForDriver(offerState, driverId) {
  if (!offerState || !Number.isFinite(Number(driverId))) return false;

  if (Number(offerState.stage) === 3) {
    const activeDriverId = Number(offerState.activeDriverId);
    return Number.isFinite(activeDriverId) && activeDriverId > 0 && activeDriverId === Number(driverId);
  }

  return Array.isArray(offerState.candidates)
    ? offerState.candidates.some((candidate) => Number(candidate?.driverId) === Number(driverId))
    : false;
}

function buildPendingScheduledOffersForDriver(driverId) {
  const pending = [];
  const now = Date.now();

  for (const offerState of scheduledOffers.values()) {
    if (!offerState || !Array.isArray(offerState.candidates)) continue;
    const isCandidate = getScheduledOfferIsEligibleForDriver(offerState, driverId);
    if (!isCandidate) continue;
    if (offerState.accepted?.has?.(driverId)) continue;
    if (offerState.rejected?.has?.(driverId)) continue;

    const expiresAt = getScheduledOfferExpiryMs(offerState);
    if (expiresAt <= now) continue;

    pending.push({
      rideId: offerState.rideId,
      stage: Number(offerState.stage || 1),
      pickupTime: offerState.pickupTime,
      createdAt: offerState.createdAt,
      timeoutMs: offerState.timeoutMs,
      expiresAt,
      timeLeftMs: Math.max(0, expiresAt - now),
      rideData: offerState.rideData || null
    });
  }

  pending.sort((a, b) => a.expiresAt - b.expiresAt);
  return pending;
}

function emitScheduledUpcomingOffersUpdate(targetDriverIds = null) {
  const io = global.io;
  if (!io) return;

  const driverIds = targetDriverIds && targetDriverIds.length
    ? Array.from(new Set(targetDriverIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))
    : Array.from(new Set(Array.from(scheduledOffers.values()).flatMap((offerState) => (offerState?.candidates || []).map((candidate) => candidate.driverId))));

  for (const driverId of driverIds) {
    const pendingOffers = buildPendingScheduledOffersForDriver(driverId);
    io.to(`driver_${driverId}`).emit('scheduledUpcomingOffersUpdate', {
      pendingCount: pendingOffers.length,
      pendingOffers
    });
  }
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

async function checkShiftViolations() {
  try {
    const now = new Date();
    const threshold = new Date(now.getTime() - SHIFT_WARNING_THRESHOLD_HOURS * 60 * 60 * 1000);

    const violatingShifts = await prisma.driversvagt.findMany({
      where: {
        startVagt: { not: null, lt: threshold },
        endVagt: null,
        shiftWarningSentAt: null
      },
      include: {
        driver: {
          select: {
            id: true,
            drFname: true,
            drLname: true,
            drEmail: true,
            company: {
              select: {
                comName: true,
                comEmail: true
              }
            }
          }
        }
      }
    });

    for (const shift of violatingShifts) {
      const driverId = shift?.driver?.id;
      if (!driverId) continue;

      try {
        await sendPushToDriver(
          driverId,
          'Shift Duration Warning',
          'Your shift has exceeded 11 hours. Please end your shift immediately as this violates safety regulations. You have 1 hour to comply or face suspension.',
          {
            type: 'shift_warning',
            shiftId: shift.id
          }
        );
      } catch (pushError) {
        console.error(`Failed sending shift warning push to driver ${driverId}:`, pushError);
      }

      const io = global.io;
      if (io) {
        io.to(`driver_${driverId}`).emit('shiftWarning', {
          message: 'Your shift has exceeded 11 hours. Please end your shift immediately.',
          shiftId: shift.id,
          timestamp: now.toISOString()
        });
      }

      try {
        if (shift.driver?.drEmail) {
          await sendEmail(
            shift.driver.drEmail,
            'Shift Duration Violation Warning',
            `<p>Dear ${shift.driver.drFname} ${shift.driver.drLname},</p>
             <p>Your current shift has exceeded 11 hours, which violates Danish traffic safety regulations.</p>
             <p>You must end your shift immediately. Failure to do so within 1 hour will result in a 3-day suspension from the platform.</p>
             <p>Please log into the driver app and end your shift now.</p>
             <p>Best regards,<br>944 Trafik Management</p>`
          );
        }
      } catch (mailError) {
        console.error(`Failed sending shift warning email to driver ${driverId}:`, mailError);
      }

      try {
        if (shift.driver?.company?.comEmail) {
          await sendEmail(
            shift.driver.company.comEmail,
            'Driver Shift Violation Alert',
            `<p>Dear ${shift.driver.company.comName} Management,</p>
             <p>Driver ${shift.driver.drFname} ${shift.driver.drLname} (ID: ${driverId}) has exceeded 11 hours on their current shift.</p>
             <p>This violates Danish traffic safety regulations. The driver has been notified and must end their shift within 1 hour.</p>
             <p>If the shift is not ended within 1 hour, the driver will be automatically suspended for 3 days.</p>
             <p>Please ensure your driver complies with regulations.</p>
             <p>Best regards,<br>944 Trafik Management</p>`
          );
        }
      } catch (mailError) {
        console.error(`Failed sending shift warning email to company for driver ${driverId}:`, mailError);
      }

      await prisma.driversvagt.update({
        where: { id: shift.id },
        data: { shiftWarningSentAt: now }
      });
    }

    const graceDeadline = new Date(now.getTime() - SHIFT_ENFORCEMENT_GRACE_HOURS * 60 * 60 * 1000);
    const expiredWarnings = await prisma.driversvagt.findMany({
      where: {
        shiftWarningSentAt: { not: null, lt: graceDeadline },
        endVagt: null
      },
      include: {
        driver: {
          select: {
            id: true,
            drFname: true,
            drLname: true,
            drEmail: true,
            company: {
              select: {
                comName: true,
                comEmail: true
              }
            }
          }
        }
      }
    });

    for (const shift of expiredWarnings) {
      const driverId = shift?.driver?.id;
      if (!driverId) continue;

      const driverState = await prisma.comDriver.findUnique({
        where: { id: driverId },
        select: { currentRideId: true }
      });

      if (driverState?.currentRideId) {
        continue;
      }

      const workTimeHours = shift.startVagt
        ? (now.getTime() - new Date(shift.startVagt).getTime()) / (1000 * 60 * 60)
        : 0;

      await prisma.driversvagt.update({
        where: { id: shift.id },
        data: {
          endVagt: now,
          workTime: workTimeHours
        }
      });

      const proposedBanUntil = new Date(now.getTime() + SHIFT_SUSPENSION_DAYS * 24 * 60 * 60 * 1000);
      const bannedUntil = await getMergedBanUntil(driverId, proposedBanUntil);

      await prisma.comDriver.update({
        where: { id: driverId },
        data: {
          bannedUntil,
          isOnline: false,
          isBusy: false,
          currentRideId: null,
          rideAccepted: 0
        }
      });

      invalidateDriverScheduleCache(driverId);

      try {
        if (shift.driver?.drEmail) {
          await sendEmail(
            shift.driver.drEmail,
            'Account Suspended - Shift Violation',
            `<p>Dear ${shift.driver.drFname} ${shift.driver.drLname},</p>
             <p>Your shift has been automatically ended due to exceeding the 11-hour limit without compliance.</p>
             <p>You are now suspended from the platform for 3 days as per safety regulations.</p>
             <p>Suspension ends: ${bannedUntil.toLocaleString()}</p>
             <p>Please contact support if you believe this is an error.</p>
             <p>Best regards,<br>944 Trafik Management</p>`
          );
        }
      } catch (mailError) {
        console.error(`Failed sending suspension email to driver ${driverId}:`, mailError);
      }

      try {
        if (shift.driver?.company?.comEmail) {
          await sendEmail(
            shift.driver.company.comEmail,
            'Driver Suspension Notice',
            `<p>Dear ${shift.driver.company.comName} Management,</p>
             <p>Driver ${shift.driver.drFname} ${shift.driver.drLname} (ID: ${driverId}) has been suspended for 3 days due to shift violation.</p>
             <p>The driver exceeded 11 hours without ending their shift after receiving warnings.</p>
             <p>Suspension ends: ${bannedUntil.toLocaleString()}</p>
             <p>Please ensure your drivers comply with regulations in the future.</p>
             <p>Best regards,<br>944 Trafik Management</p>`
          );
        }
      } catch (mailError) {
        console.error(`Failed sending suspension email to company for driver ${driverId}:`, mailError);
      }
    }
  } catch (error) {
    console.error('Error in checkShiftViolations:', error);
  }
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
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
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

    const strategyVehicleIds = data.vehicles.map((id) => Number(id)).filter((id) => Number.isFinite(id));

    const vehicles = await prisma.comVehicles.findMany({
      where: {
        id: { in: strategyVehicleIds }
      },
      select: {
        id: true,
        regNumber: true
      }
    });

    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const orderedVehicles = strategyVehicleIds
      .map((vehicleId) => vehicleMap.get(vehicleId))
      .filter(Boolean);

    const carPlates = orderedVehicles.map(v => v.regNumber);
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

    const vehicleInfo = await Promise.all(orderedVehicles.map(async (vehicle, index) => {
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

function normalizePostalCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.match(/\d+/g);
  if (!digits) return raw.toUpperCase();
  return digits.join('');
}

function getPostalPrefix(value, len = SCHEDULED_STAGE3_POSTAL_PREFIX_LEN) {
  const normalized = normalizePostalCode(value);
  if (!normalized) return '';
  return normalized.slice(0, Math.max(1, Number(len) || SCHEDULED_STAGE3_POSTAL_PREFIX_LEN));
}

function parsePostalCodeFromAddress(address) {
  const raw = String(address || '');
  if (!raw) return '';
  const match = raw.match(/\b\d{4,6}\b/);
  return match ? normalizePostalCode(match[0]) : '';
}

function scorePostalProximity(driverPostalCode, ridePostalCode) {
  const driverNorm = normalizePostalCode(driverPostalCode);
  const rideNorm = normalizePostalCode(ridePostalCode);
  if (!driverNorm || !rideNorm) {
    return {
      score: SCHEDULED_STAGE3_FALLBACK_DISTANCE_PENALTY,
      exact: false,
      prefixMatch: false
    };
  }

  if (driverNorm === rideNorm) {
    return {
      score: 0,
      exact: true,
      prefixMatch: true
    };
  }

  const driverPrefix = getPostalPrefix(driverNorm);
  const ridePrefix = getPostalPrefix(rideNorm);
  const prefixMatch = Boolean(driverPrefix && ridePrefix && driverPrefix === ridePrefix);

  const driverNum = Number(driverNorm);
  const rideNum = Number(rideNorm);
  const numericDiff = Number.isFinite(driverNum) && Number.isFinite(rideNum)
    ? Math.abs(driverNum - rideNum)
    : SCHEDULED_STAGE3_FALLBACK_DISTANCE_PENALTY;

  return {
    score: prefixMatch ? numericDiff : numericDiff + 5000,
    exact: false,
    prefixMatch
  };
}

function isHolidayDate(at) {
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return false;

  const dayOfWeek = at.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  try {
    const hd = new Holidays('DK');
    const holidays = hd.getHolidays(at.getFullYear());
    const ymd = at.toISOString().slice(0, 10);
    if (holidays.some((h) => String(h?.date || '').slice(0, 10) === ymd)) return true;
  } catch (error) {
    console.error('Error checking Danish holidays for scheduled stage2:', error);
  }

  const ymd = at.toISOString().slice(0, 10);
  const list = (process.env.HOLIDAYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes(ymd);
}

function getScheduledHourlyRateThreshold(vehicleTypeId, at) {
  const thresholds = SCHEDULED_STAGE2_RATE_THRESHOLDS[Number(vehicleTypeId)] || SCHEDULED_STAGE2_RATE_THRESHOLDS[1];
  const holiday = isHolidayDate(at);
  const hour = at.getHours();
  const night = hour < 6 || hour >= 18;

  if (holiday) return thresholds.holiday;
  if (night) return thresholds.night;
  return thresholds.day;
}

function isScheduledStage2Profitable({ vehicleTypeId, ridePrice, totalMinutes, at }) {
  const safePrice = Number(ridePrice || 0);
  const safeMinutes = Number(totalMinutes || 0);
  if (safePrice <= 0 || safeMinutes <= 0) {
    return {
      eligible: false,
      threshold: getScheduledHourlyRateThreshold(vehicleTypeId, at),
      pricePerHour: 0
    };
  }

  const totalHours = safeMinutes / 60;
  if (totalHours <= 0) {
    return {
      eligible: false,
      threshold: getScheduledHourlyRateThreshold(vehicleTypeId, at),
      pricePerHour: 0
    };
  }

  const pricePerHour = safePrice / totalHours;
  const threshold = getScheduledHourlyRateThreshold(vehicleTypeId, at);
  return {
    eligible: pricePerHour >= threshold,
    threshold,
    pricePerHour
  };
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

function computeRideEndTime(pickupTime, durationMin, distanceKm) {
  if (!pickupTime) return null;
  const duration = Number.isFinite(durationMin)
    ? Number(durationMin)
    : (Number.isFinite(distanceKm) ? Math.max(1, Math.ceil(Number(distanceKm) * 2)) : 30);
  return new Date(pickupTime.getTime() + duration * 60000);
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
        if (gapMinutes >= 0 && gapMinutes <= SCHEDULED_CHAIN_MAX_GAP_MINUTES) {
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
            const maxTravelMinutesForGap = Math.min(
              SCHEDULED_CHAIN_MAX_TRAVEL_MINUTES,
              Math.max(1, Math.ceil(gapMinutes))
            );
            if (etaMinutes <= maxTravelMinutesForGap) {
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

  const excludedDriverIds = new Set(
    Array.from(global.rejectedRides?.get?.(ride.id) || []).map((id) => Number(id))
  );

  let strategyDriverIds = [];
  try {
    const vsResp = await fetch('http://localhost:3000/api/vehicle-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        pickupLat: ride.startLatLon.lat,
        pickupLon: ride.startLatLon.lon,
        vehicleTypeId: ride.vehicleTypeId,
        maxVehicles: 3,
        excludedDriverIds: Array.from(excludedDriverIds),
        scheduledPickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : undefined
      })
    });

    if (vsResp.ok) {
      const vsData = await vsResp.json();
      if (Array.isArray(vsData?.scores)) {
        strategyDriverIds = vsData.scores
          .map((score) => Number(score?.driverId))
          .filter((id) => Number.isFinite(id) && id > 0);
      }
    } else {
      console.warn(`vehicle-selection returned non-OK while building scheduled candidates for ride ${ride.id}:`, vsResp.status);
    }
  } catch (error) {
    console.error(`Error calling vehicle-selection for scheduled ride ${ride.id}:`, error);
  }

  const uniqueStrategyDriverIds = Array.from(new Set(strategyDriverIds));
  if (!uniqueStrategyDriverIds.length) {
    return [];
  }

  const rawDriversMap = new Map();

  uniqueStrategyDriverIds.forEach((driverId) => {
    const connected = connectedDrivers.get(driverId);
    if (connected?.location && typeof connected.location.lat === 'number' && typeof connected.location.lng === 'number') {
      rawDriversMap.set(driverId, {
        driverId,
        location: connected.location,
        vehicleTypeId: connected.vehicleTypeId ? Number(connected.vehicleTypeId) : null,
        connected: true
      });
    }
  });

  const missingLocationDriverIds = uniqueStrategyDriverIds.filter((driverId) => !rawDriversMap.has(driverId));
  if (missingLocationDriverIds.length) {
    try {
      const fallbackDrivers = await prisma.comDriver.findMany({
        where: {
          id: { in: missingLocationDriverIds },
          lastLocation: { not: null }
        },
        select: {
          id: true,
          lastLocation: true
        }
      });

      fallbackDrivers.forEach((driver) => {
        if (rawDriversMap.has(driver.id)) return;
        if (!Array.isArray(driver.lastLocation) || driver.lastLocation.length < 2) return;
        const [lat, lng] = driver.lastLocation;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        rawDriversMap.set(driver.id, {
          driverId: driver.id,
          location: { lat, lng },
          vehicleTypeId: null,
          connected: Boolean(connectedDrivers.get(driver.id))
        });
      });
    } catch (error) {
      console.error(`Error loading fallback locations for scheduled ride ${ride.id}:`, error);
    }
  }

  const rawDrivers = Array.from(rawDriversMap.values());
  if (rawDrivers.length === 0) return [];

  const driverIds = rawDrivers.map((d) => d.driverId);
  const now = new Date();

  const driverRecords = await prisma.comDriver.findMany({
    where: {
      id: { in: driverIds },
      isActive: true,
      car: { not: null },
      isOnline: true,
      OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }]
    },
    select: {
      id: true,
      car: true,
      rating: true,
      currentRideId: true,
      isBusy: true
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

    const hasOngoingImmediateRide = Boolean(driver.currentRideId);
    if (hasOngoingImmediateRide) {
      try {
        const currentRide = await prisma.ride.findUnique({
          where: { id: driver.currentRideId },
          select: {
            id: true,
            scheduled: true,
            status: true,
            endLatLon: true,
            pickupTime: true,
            acceptedAt: true,
            pickedAt: true,
            createdAt: true,
            distanceKm: true,
            durationMin: true
          }
        });

        if (!currentRide) {
          continue;
        }

        if (!currentRide.scheduled && ['DISPATCHED', 'ONGOING', 'IN_PROGRESS', 'PICKED_UP', 'CONFIRMED'].includes(String(currentRide.status || '').toUpperCase())) {
          const currentRideStartReference = currentRide.pickupTime
            ? new Date(currentRide.pickupTime)
            : currentRide.pickedAt
              ? new Date(currentRide.pickedAt)
              : currentRide.acceptedAt
                ? new Date(currentRide.acceptedAt)
                : currentRide.createdAt
                  ? new Date(currentRide.createdAt)
                  : new Date();

          const currentRideEnd = computeRideEndTime(
            currentRideStartReference,
            currentRide.durationMin,
            currentRide.distanceKm
          );

          const scheduledStart = ride.pickupTime ? new Date(ride.pickupTime) : null;
          const hasValidCurrentRideEnd = Boolean(currentRideEnd && !Number.isNaN(currentRideEnd.getTime()));
          const hasValidScheduledStart = Boolean(scheduledStart && !Number.isNaN(scheduledStart.getTime()));

          // لا نحجب ظهور العرض إذا كانت بيانات التوقيت غير مكتملة؛ نُطبق التحقق فقط عند توفر وقت صالح للطرفين.
          if (hasValidCurrentRideEnd && hasValidScheduledStart) {
            const gapMinutes = (scheduledStart.getTime() - currentRideEnd.getTime()) / 60000;
            if (gapMinutes < -5) {
              continue;
            }
          }

          if (currentRide.endLatLon && typeof currentRide.endLatLon.lat === 'number' && typeof currentRide.endLatLon.lon === 'number') {
            raw.location = {
              lat: currentRide.endLatLon.lat,
              lng: currentRide.endLatLon.lon
            };
          }
        }
      } catch (error) {
        console.error(`Error evaluating current ride for scheduled candidate ${raw.driverId}:`, error);
        continue;
      }
    }

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

  const eligibleBySchedule = [];
  for (const candidate of candidates) {
    try {
      const schedule = await canDriverReceiveRide(prisma, candidate.driverId, {
        strict: true,
        now: new Date()
      });
      if (!schedule?.eligible) {
        continue;
      }
      eligibleBySchedule.push(candidate);
    } catch (error) {
      console.error(`Error checking schedule eligibility for driver ${candidate.driverId}:`, error);
    }
  }

  if (!eligibleBySchedule.length) return [];

  const conflictedFiltered = await filterConflictingDrivers(eligibleBySchedule, ride);
  const strategyOrder = new Map(uniqueStrategyDriverIds.map((id, index) => [id, index]));
  conflictedFiltered.sort((a, b) => {
    const aPriority = Boolean(a.chainPriority);
    const bPriority = Boolean(b.chainPriority);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;

    const aChainEta = Number.isFinite(a.chainEtaMinutes) ? a.chainEtaMinutes : Number.POSITIVE_INFINITY;
    const bChainEta = Number.isFinite(b.chainEtaMinutes) ? b.chainEtaMinutes : Number.POSITIVE_INFINITY;
    if (aChainEta !== bChainEta) return aChainEta - bChainEta;

    const aGap = Number.isFinite(a.chainGapMinutes) ? a.chainGapMinutes : Number.POSITIVE_INFINITY;
    const bGap = Number.isFinite(b.chainGapMinutes) ? b.chainGapMinutes : Number.POSITIVE_INFINITY;
    if (aGap !== bGap) return aGap - bGap;

    const orderA = strategyOrder.has(a.driverId) ? strategyOrder.get(a.driverId) : Number.MAX_SAFE_INTEGER;
    const orderB = strategyOrder.has(b.driverId) ? strategyOrder.get(b.driverId) : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    return a.distanceKm - b.distanceKm;
  });

  return conflictedFiltered;
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

async function buildScheduledStage2Candidates(ride) {
  if (!ride || !ride.startLatLon) return [];

  const excludedDriverIds = new Set(
    Array.from(global.rejectedRides?.get?.(ride.id) || []).map((id) => Number(id))
  );

  let strategyDriverIds = [];
  try {
    const vsResp = await fetch('http://localhost:3000/api/vehicle-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        pickupLat: ride.startLatLon.lat,
        pickupLon: ride.startLatLon.lon,
        vehicleTypeId: ride.vehicleTypeId,
        maxVehicles: 30,
        excludedDriverIds: Array.from(excludedDriverIds),
        scheduledPickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : undefined
      })
    });

    if (vsResp.ok) {
      const vsData = await vsResp.json();
      if (Array.isArray(vsData?.scores)) {
        strategyDriverIds = vsData.scores
          .map((score) => Number(score?.driverId))
          .filter((id) => Number.isFinite(id) && id > 0);
      }
    }
  } catch (error) {
    console.error(`Error loading stage2 candidates from vehicle-selection for ride ${ride?.id}:`, error);
  }

  const uniqueDriverIds = Array.from(new Set(strategyDriverIds));
  if (!uniqueDriverIds.length) return [];

  const now = new Date();

  const driverRecords = await prisma.comDriver.findMany({
    where: {
      id: { in: uniqueDriverIds },
      isActive: true,
      isOnline: true,
      car: { not: null },
      OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }]
    },
    select: {
      id: true,
      car: true,
      rating: true
    }
  });

  if (!driverRecords.length) return [];

  const driverMap = new Map(driverRecords.map((d) => [d.id, d]));

  const rawDriversMap = new Map();
  uniqueDriverIds.forEach((driverId) => {
    const connected = connectedDrivers.get(driverId);
    if (connected?.location && typeof connected.location.lat === 'number' && typeof connected.location.lng === 'number') {
      rawDriversMap.set(driverId, {
        driverId,
        location: connected.location,
        connected: true
      });
    }
  });

  const missingIds = uniqueDriverIds.filter((id) => !rawDriversMap.has(id));
  if (missingIds.length) {
    try {
      const fallback = await prisma.comDriver.findMany({
        where: {
          id: { in: missingIds },
          lastLocation: { not: null }
        },
        select: { id: true, lastLocation: true }
      });

      fallback.forEach((driver) => {
        if (rawDriversMap.has(driver.id)) return;
        if (!Array.isArray(driver.lastLocation) || driver.lastLocation.length < 2) return;
        const [lat, lng] = driver.lastLocation;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        rawDriversMap.set(driver.id, {
          driverId: driver.id,
          location: { lat, lng },
          connected: Boolean(connectedDrivers.get(driver.id))
        });
      });
    } catch (error) {
      console.error(`Error loading fallback locations for stage2 ride ${ride?.id}:`, error);
    }
  }

  const rawDrivers = Array.from(rawDriversMap.values());
  if (!rawDrivers.length) return [];

  const allowedTypes = getAllowedTypes(ride.vehicleTypeId);
  const vehicles = await prisma.comVehicles.findMany({
    where: { regNumber: { in: driverRecords.map((d) => d.car).filter(Boolean) } },
    select: { id: true, regNumber: true, vehicleType: true }
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.regNumber, v]));

  const stageAt = ride.pickupTime ? new Date(ride.pickupTime) : new Date();
  const durationMin = getRideDurationMinutes(ride);
  const candidates = [];

  for (const raw of rawDrivers) {
    const driver = driverMap.get(raw.driverId);
    if (!driver || !driver.car) continue;

    const vehicle = vehicleMap.get(driver.car);
    const resolvedVehicleTypeId = resolveVehicleTypeId(null, vehicle?.vehicleType, ride.vehicleTypeId);
    if (!resolvedVehicleTypeId || !allowedTypes.includes(resolvedVehicleTypeId)) continue;

    const schedule = await canDriverReceiveRide(prisma, driver.id, {
      // Stage 2 targets future scheduled rides; validate shift window at pickup time
      // without applying current worked-minutes caps to future timestamps.
      strict: false,
      now: stageAt
    });
    if (!schedule?.eligible) continue;

    const distanceKm = calculateDistanceKm(
      ride.startLatLon.lat,
      ride.startLatLon.lon,
      raw.location.lat,
      raw.location.lng
    );
    const etaMinutes = estimateEtaMinutesFromDistance(distanceKm);
    if (!Number.isFinite(etaMinutes) || etaMinutes <= 0 || etaMinutes > SCHEDULED_STAGE2_MAX_ETA_MINUTES) continue;

    const totalMinutes = etaMinutes + durationMin;
    const profitability = isScheduledStage2Profitable({
      vehicleTypeId: resolvedVehicleTypeId,
      ridePrice: Number(ride.price || 0),
      totalMinutes,
      at: stageAt
    });

    if (!profitability.eligible) {
      continue;
    }

    candidates.push({
      driverId: driver.id,
      car: driver.car,
      rating: Number(driver.rating || 0),
      vehicleTypeId: resolvedVehicleTypeId,
      location: raw.location,
      distanceKm,
      etaMinutes,
      totalMinutes,
      pricePerHour: profitability.pricePerHour,
      threshold: profitability.threshold,
      chainPriority: false,
      chainRideId: null,
      chainGapMinutes: null,
      chainDistanceKm: null,
      chainEtaMinutes: null
    });
  }

  const conflictFiltered = await filterConflictingDrivers(candidates, ride);
  conflictFiltered.sort((a, b) => {
    const aPriority = Boolean(a.chainPriority);
    const bPriority = Boolean(b.chainPriority);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;
    const aGap = Number.isFinite(a.chainGapMinutes) ? a.chainGapMinutes : Number.POSITIVE_INFINITY;
    const bGap = Number.isFinite(b.chainGapMinutes) ? b.chainGapMinutes : Number.POSITIVE_INFINITY;
    if (aGap !== bGap) return aGap - bGap;
    if (a.etaMinutes !== b.etaMinutes) return a.etaMinutes - b.etaMinutes;
    return a.distanceKm - b.distanceKm;
  });

  return conflictFiltered;
}

async function buildScheduledStage3Candidates(ride) {
  if (!ride || !ride.startLatLon || !ride.pickupTime) return [];

  const excludedDriverIds = new Set(
    Array.from(global.rejectedRides?.get?.(ride.id) || []).map((id) => Number(id))
  );

  const ridePostalCode = parsePostalCodeFromAddress(ride.pickupAddress);

  let strategyDriverIds = [];
  try {
    const vsResp = await fetch('http://localhost:3000/api/vehicle-selection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
      },
      body: JSON.stringify({
        pickupLat: ride.startLatLon.lat,
        pickupLon: ride.startLatLon.lon,
        vehicleTypeId: ride.vehicleTypeId,
        maxVehicles: 200,
        excludedDriverIds: Array.from(excludedDriverIds),
        scheduledPickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : undefined
      })
    });

    if (vsResp.ok) {
      const vsData = await vsResp.json();
      if (Array.isArray(vsData?.scores)) {
        strategyDriverIds = vsData.scores
          .map((score) => Number(score?.driverId))
          .filter((id) => Number.isFinite(id) && id > 0);
      }
    }
  } catch (error) {
    console.error(`Error loading stage3 candidates from vehicle-selection for ride ${ride?.id}:`, error);
  }

  const uniqueDriverIds = Array.from(new Set(strategyDriverIds));
  if (!uniqueDriverIds.length) return [];

  const now = new Date();
  const allowedTypes = getAllowedTypes(ride.vehicleTypeId);

  const driverRecords = await prisma.comDriver.findMany({
    where: {
      id: { in: uniqueDriverIds },
      isActive: true,
      isOnline: true,
      car: { not: null },
      OR: [{ bannedUntil: null }, { bannedUntil: { lte: now } }]
    },
    select: {
      id: true,
      car: true,
      rating: true,
      drAddress: true,
      createdAt: true
    }
  });

  if (!driverRecords.length) return [];

  const vehicleRows = await prisma.comVehicles.findMany({
    where: {
      regNumber: {
        in: driverRecords.map((d) => d.car).filter(Boolean)
      }
    },
    select: {
      regNumber: true,
      vehicleType: true
    }
  });

  const vehicleMap = new Map(vehicleRows.map((v) => [v.regNumber, v]));
  const strategyOrder = new Map(uniqueDriverIds.map((id, idx) => [id, idx]));
  const rideAt = new Date(ride.pickupTime);

  const candidates = [];

  for (const driver of driverRecords) {
    const resolvedVehicleTypeId = resolveVehicleTypeId(
      null,
      vehicleMap.get(driver.car)?.vehicleType,
      ride.vehicleTypeId
    );

    if (!resolvedVehicleTypeId || !allowedTypes.includes(resolvedVehicleTypeId)) continue;

    const schedule = await canDriverReceiveRide(prisma, driver.id, {
      // Stage 3 (>24h) should check schedule window alignment at pickup time,
      // not strict current accumulated limits against a future timestamp.
      strict: false,
      now: rideAt
    });
    if (!schedule?.eligible) {
      continue;
    }

    const driverPostalCode = parsePostalCodeFromAddress(driver.drAddress || '');
    const postalScore = scorePostalProximity(driverPostalCode, ridePostalCode);
    const strategyIndex = strategyOrder.has(driver.id)
      ? strategyOrder.get(driver.id)
      : Number.MAX_SAFE_INTEGER;

    const completedRides = await prisma.ride.count({
      where: {
        driverId: driver.id,
        status: 'COMPLETED'
      }
    });

    candidates.push({
      driverId: driver.id,
      car: driver.car,
      rating: Number(driver.rating || 0),
      vehicleTypeId: resolvedVehicleTypeId,
      strategyIndex,
      homeAddress: driver.drAddress || '',
      postalCode: driverPostalCode,
      postalExact: postalScore.exact,
      postalPrefixMatch: postalScore.prefixMatch,
      postalDistanceScore: postalScore.score,
      completedRides,
      experienceScore: Math.floor(Number(completedRides || 0) / 100) * 3,
      joinedAtMs: driver.createdAt ? new Date(driver.createdAt).getTime() : 0
    });
  }

  const chainAwareCandidates = await filterConflictingDrivers(candidates, ride);
  chainAwareCandidates.sort((a, b) => {
    const aPriority = Boolean(a.chainPriority);
    const bPriority = Boolean(b.chainPriority);
    if (aPriority !== bPriority) return aPriority ? -1 : 1;
    const aChainEta = Number.isFinite(a.chainEtaMinutes) ? a.chainEtaMinutes : Number.POSITIVE_INFINITY;
    const bChainEta = Number.isFinite(b.chainEtaMinutes) ? b.chainEtaMinutes : Number.POSITIVE_INFINITY;
    if (aChainEta !== bChainEta) return aChainEta - bChainEta;
    const aGap = Number.isFinite(a.chainGapMinutes) ? a.chainGapMinutes : Number.POSITIVE_INFINITY;
    const bGap = Number.isFinite(b.chainGapMinutes) ? b.chainGapMinutes : Number.POSITIVE_INFINITY;
    if (aGap !== bGap) return aGap - bGap;
    if (a.postalExact !== b.postalExact) return a.postalExact ? -1 : 1;
    if (a.postalPrefixMatch !== b.postalPrefixMatch) return a.postalPrefixMatch ? -1 : 1;
    if (a.postalDistanceScore !== b.postalDistanceScore) return a.postalDistanceScore - b.postalDistanceScore;
    if (a.rating !== b.rating) return b.rating - a.rating;
    if (a.experienceScore !== b.experienceScore) return b.experienceScore - a.experienceScore;
    if (a.vehicleTypeId !== b.vehicleTypeId) {
      const aExact = a.vehicleTypeId === Number(ride.vehicleTypeId);
      const bExact = b.vehicleTypeId === Number(ride.vehicleTypeId);
      if (aExact !== bExact) return aExact ? -1 : 1;
    }
    if (a.strategyIndex !== b.strategyIndex) return a.strategyIndex - b.strategyIndex;
    return b.completedRides - a.completedRides;
  });

  return chainAwareCandidates;
}

async function advanceScheduledStage3Offer(rideId, reason = 'advance') {
  const offerState = scheduledOffers.get(rideId);
  if (!offerState || offerState.stage !== 3) return;

  if (offerState.timerId) {
    clearTimeout(offerState.timerId);
    offerState.timerId = null;
  }

  while (offerState.currentIndex < offerState.candidates.length) {
    const candidate = offerState.candidates[offerState.currentIndex];

    if (offerState.accepted?.has?.(candidate.driverId)) {
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
          vehicleTypeId: true,
          riderName: true
        }
      });

      if (!ride || ride.status !== 'CONFIRMED' || ride.driverId) {
        scheduledOffers.delete(rideId);
        emitScheduledUpcomingOffersUpdate([candidate.driverId]);
        return;
      }

      const now = new Date();
      const selectedDriver = await prisma.comDriver.findUnique({
        where: { id: candidate.driverId },
        select: {
          id: true,
          car: true,
          drFname: true,
          drLname: true,
          isOnline: true,
          bannedUntil: true,
          isActive: true
        }
      });

      if (!selectedDriver || !selectedDriver.isActive || !selectedDriver.isOnline || (selectedDriver.bannedUntil && selectedDriver.bannedUntil > now)) {
        if (selectedDriver?.bannedUntil && selectedDriver.bannedUntil > now && isDriverOfferRestrictedByBan(selectedDriver.bannedUntil, now)) {
          console.log(`Stage3 skip driver ${candidate.driverId} due to short active ban restriction until ${selectedDriver.bannedUntil}`);
        }
        offerState.accepted.delete(candidate.driverId);
        offerState.rejected.add(candidate.driverId);
        offerState.currentIndex += 1;
        continue;
      }

      await prisma.ride.update({
        where: { id: rideId },
        data: {
          driverId: selectedDriver.id,
          car: selectedDriver.car || candidate.car || null,
          driverQueue: offerState.candidates.map((c) => c.driverId)
        }
      });

      const rideData = buildRidePayload(ride);
      const io = global.io;

      for (const stagedCandidate of offerState.candidates) {
        const isSelected = stagedCandidate.driverId === selectedDriver.id;
        if (io) {
          io.to(`driver_${stagedCandidate.driverId}`).emit('scheduledOfferResult', {
            rideId,
            selected: isSelected,
            pickupTime: ride.pickupTime,
            rideData,
            stage: 3
          });
        }

        if (offerState.accepted?.has?.(stagedCandidate.driverId)) {
          try {
            await sendPushToDriver(
              stagedCandidate.driverId,
              isSelected ? 'Scheduled ride assigned' : 'Scheduled ride not assigned',
              isSelected
                ? 'You were selected for this scheduled ride.'
                : 'Another driver was selected for this scheduled ride.',
              {
                type: 'scheduledRideOfferResult',
                stage: 3,
                rideId,
                selected: isSelected,
                pickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : null
              }
            );
          } catch (error) {
            console.error(`Error sending scheduled stage3 result push to driver ${stagedCandidate.driverId}:`, error);
          }
        }
      }

      scheduledOffers.delete(rideId);
      emitScheduledUpcomingOffersUpdate(offerState.candidates.map((c) => c.driverId));
      return;
    }

    if (offerState.rejected?.has?.(candidate.driverId)) {
      offerState.currentIndex += 1;
      continue;
    }

    const driver = await prisma.comDriver.findUnique({
      where: { id: candidate.driverId },
      select: {
        id: true,
        isOnline: true,
        isActive: true,
        bannedUntil: true
      }
    });

    const now = new Date();
    if (!driver || !driver.isActive || !driver.isOnline || (driver.bannedUntil && driver.bannedUntil > now)) {
      offerState.rejected.add(candidate.driverId);
      offerState.currentIndex += 1;
      continue;
    }

    offerState.activeDriverId = candidate.driverId;
    offerState.createdAt = Date.now();
    offerState.timeoutMs = SCHEDULED_STAGE3_OFFER_TIMEOUT_MS;

    emitScheduledUpcomingOffersUpdate(offerState.candidates.map((c) => c.driverId));

    try {
      await sendPushToDriver(
        candidate.driverId,
        'Scheduled ride opportunity',
        'A scheduled ride opportunity is available in upcoming rides. You have 10 minutes to answer.',
        {
          type: 'scheduledRideOffer',
          stage: 3,
          rideId,
          expiresAt: new Date(offerState.createdAt + SCHEDULED_STAGE3_OFFER_TIMEOUT_MS).toISOString(),
          pickupTime: offerState.pickupTime ? new Date(offerState.pickupTime).toISOString() : null
        }
      );
    } catch (error) {
      console.error(`Error sending stage3 scheduled push to driver ${candidate.driverId}:`, error);
    }

    offerState.timerId = setTimeout(() => {
      const current = scheduledOffers.get(rideId);
      if (!current || current.stage !== 3) return;
      const activeId = Number(current.activeDriverId);
      if (Number.isFinite(activeId) && activeId > 0 && !current.accepted.has(activeId)) {
        current.rejected.add(activeId);
      }
      current.currentIndex = Number(current.currentIndex || 0) + 1;
      advanceScheduledStage3Offer(rideId, 'timeout').catch((error) => {
        console.error(`Error advancing stage3 offer after timeout for ride ${rideId}:`, error);
      });
    }, SCHEDULED_STAGE3_OFFER_TIMEOUT_MS);

    return;
  }

  scheduledOfferCooldowns.set(rideId, Date.now() + 60 * 1000);
  scheduledOffers.delete(rideId);
  emitScheduledUpcomingOffersUpdate(offerState.candidates.map((c) => c.driverId));
  console.log(`No drivers accepted scheduled stage3 ride ${rideId} (reason: ${reason})`);
}

async function broadcastScheduledRideOfferStage3(ride) {
  if (!ride || !ride.startLatLon || !ride.pickupTime) return;
  if (scheduledOffers.has(ride.id)) return;

  const existingCooldown = scheduledOfferCooldowns.get(ride.id);
  if (existingCooldown && existingCooldown > Date.now()) {
    return;
  }

  const candidates = await buildScheduledStage3Candidates(ride);
  if (!candidates.length) {
    console.log(`No eligible stage3 drivers for scheduled ride ${ride.id}`);
    return;
  }

  try {
    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        driverQueue: candidates.map((c) => c.driverId),
        driverId: null,
        car: null
      }
    });
  } catch (error) {
    console.warn(`Failed to persist stage3 offer queue for ride ${ride.id}:`, error);
  }

  const nowMs = Date.now();
  const rideData = {
    ...buildRidePayload(ride),
    scheduledOfferOnly: true,
    stage: 3
  };

  const offerState = {
    stage: 3,
    rideId: ride.id,
    pickupTime: ride.pickupTime,
    vehicleTypeId: ride.vehicleTypeId,
    candidates,
    accepted: new Map(),
    rejected: new Set(),
    createdAt: nowMs,
    timeoutMs: SCHEDULED_STAGE3_OFFER_TIMEOUT_MS,
    timerId: null,
    rideData,
    currentIndex: 0,
    activeDriverId: null
  };

  scheduledOffers.set(ride.id, offerState);

  await advanceScheduledStage3Offer(ride.id, 'start');
}

async function finalizeScheduledStage2Offer(rideId) {
  const offerState = scheduledOffers.get(rideId);
  if (!offerState || offerState.stage !== 2) return;

  if (offerState.timerId) {
    clearTimeout(offerState.timerId);
  }

  scheduledOffers.delete(rideId);

  const accepted = Array.from(offerState.accepted.values());
  if (!accepted.length) {
    scheduledOfferCooldowns.set(rideId, Date.now() + 60 * 1000);
    emitScheduledUpcomingOffersUpdate(offerState.candidates.map((candidate) => candidate.driverId));
    console.log(`No drivers accepted scheduled stage2 ride ${rideId}`);
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
      vehicleTypeId: true,
      riderName: true
    }
  });

  if (!ride || ride.status !== 'CONFIRMED' || ride.driverId) {
    console.log(`Scheduled stage2 ride ${rideId} no longer available for assignment`);
    return;
  }

  const now = new Date();
  const scheduleAt = ride.pickupTime ? new Date(ride.pickupTime) : now;
  const eligibleAccepted = [];
  const driverInfoMap = new Map();

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
          bannedUntil: true,
          isActive: true
        }
      });

      if (!driver || !driver.isActive) continue;
      if (!driver.isOnline) continue;
      if (driver.bannedUntil && driver.bannedUntil > now) {
        if (isDriverOfferRestrictedByBan(driver.bannedUntil, now)) {
          console.log(`Scheduled stage2 skip driver ${candidate.driverId} due to short active ban restriction until ${driver.bannedUntil}`);
        }
        continue;
      }

      const schedule = await canDriverReceiveRide(prisma, candidate.driverId, {
        // Final stage-2 selection still validates pickup-time schedule window only.
        strict: false,
        now: scheduleAt
      });
      if (!schedule?.eligible) continue;

      const location = await resolveDriverLocation(candidate.driverId);
      if (!location || !ride.startLatLon) continue;

      const distanceKm = calculateDistanceKm(
        ride.startLatLon.lat,
        ride.startLatLon.lon,
        location.lat,
        location.lng
      );
      const etaMinutes = estimateEtaMinutesFromDistance(distanceKm);

      eligibleAccepted.push({
        ...candidate,
        distanceKm,
        etaMinutes
      });
      driverInfoMap.set(candidate.driverId, driver);
    } catch (error) {
      console.error(`Error validating stage2 accepted driver ${candidate.driverId}:`, error);
    }
  }

  if (!eligibleAccepted.length) {
    console.log(`No eligible accepted drivers for scheduled stage2 ride ${rideId}`);
    return;
  }

  const selected = selectBestScheduledCandidate(eligibleAccepted, ride.vehicleTypeId);
  if (!selected) {
    console.log(`No suitable accepted driver found for scheduled stage2 ride ${rideId}`);
    return;
  }
  const selectedDriver = driverInfoMap.get(selected.driverId);

  await prisma.ride.update({
    where: { id: rideId },
    data: {
      driverId: selected.driverId,
      car: selectedDriver?.car || selected.car || null,
      driverQueue: eligibleAccepted.map((c) => c.driverId)
    }
  });

  const io = global.io;
  const rideData = buildRidePayload(ride);
  for (const candidate of accepted) {
    const isSelected = candidate.driverId === selected.driverId;
    if (io) {
      io.to(`driver_${candidate.driverId}`).emit('scheduledOfferResult', {
        rideId,
        selected: isSelected,
        pickupTime: ride.pickupTime,
        rideData,
        stage: 2
      });
    }

    try {
      await sendPushToDriver(
        candidate.driverId,
        isSelected ? 'Scheduled ride assigned' : 'Scheduled ride not assigned',
        isSelected
          ? 'You were selected for this scheduled ride.'
          : 'Another driver was selected for this scheduled ride.',
        {
          type: 'scheduledRideOfferResult',
          stage: 2,
          rideId,
          selected: isSelected,
          pickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : null
        }
      );
    } catch (error) {
      console.error(`Error sending scheduled stage2 result push to driver ${candidate.driverId}:`, error);
    }
  }

  emitScheduledUpcomingOffersUpdate(offerState.candidates.map((candidate) => candidate.driverId));
}

async function broadcastScheduledRideOfferStage2(ride) {
  if (!ride || !ride.startLatLon || !ride.pickupTime) return;
  if (scheduledOffers.has(ride.id)) return;

  const existingCooldown = scheduledOfferCooldowns.get(ride.id);
  if (existingCooldown && existingCooldown > Date.now()) {
    return;
  }

  const candidates = await buildScheduledStage2Candidates(ride);
  if (!candidates.length) {
    console.log(`No eligible stage2 drivers for scheduled ride ${ride.id}`);
    return;
  }

  const nowMs = Date.now();
  const rideData = {
    ...buildRidePayload(ride),
    scheduledOfferOnly: true,
    stage: 2
  };

  const offerState = {
    stage: 2,
    rideId: ride.id,
    pickupTime: ride.pickupTime,
    vehicleTypeId: ride.vehicleTypeId,
    candidates,
    accepted: new Map(),
    rejected: new Set(),
    createdAt: nowMs,
    timeoutMs: SCHEDULED_STAGE2_OFFER_TIMEOUT_MS,
    timerId: null,
    rideData
  };

  scheduledOffers.set(ride.id, offerState);

  try {
    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        driverQueue: Array.from(new Set(candidates.map((c) => c.driverId))),
        driverId: null,
        car: null
      }
    });
  } catch (error) {
    console.warn(`Failed to persist stage2 offer queue for ride ${ride.id}:`, error);
  }

  emitScheduledUpcomingOffersUpdate(candidates.map((candidate) => candidate.driverId));

  for (const candidate of candidates) {
    try {
      await sendPushToDriver(
        candidate.driverId,
        'Scheduled ride request',
        'A scheduled ride request is available. Please answer Yes/No within 3 minutes.',
        {
          type: 'scheduledRideOffer',
          stage: 2,
          rideId: ride.id,
          expiresAt: new Date(nowMs + SCHEDULED_STAGE2_OFFER_TIMEOUT_MS).toISOString(),
          pickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : null
        }
      );
    } catch (error) {
      console.error(`Error sending stage2 scheduled push to driver ${candidate.driverId}:`, error);
    }
  }

  offerState.timerId = setTimeout(() => {
    finalizeScheduledStage2Offer(ride.id).catch((error) => {
      console.error(`Error finalizing stage2 scheduled offer for ride ${ride.id}:`, error);
    });
  }, SCHEDULED_STAGE2_OFFER_TIMEOUT_MS);
}

async function assignScheduledRideFromQueue(ride) {
  const queueIds = normalizeDriverQueue(ride.driverQueue);
  if (!queueIds.length) return false;

  const candidates = await buildScheduledCandidates(ride);
  if (!candidates.length) return false;

    // إذا لم يوجد queue، جرّب تتابع السائق المرتبط بالرحلة السابقة ضمن نافذة الزمن والمسافة
    let acceptedCandidates = candidates.filter((candidate) => queueIds.includes(candidate.driverId));
    if (!acceptedCandidates.length) {
      const chained = candidates.filter((c) => c.chainPriority === true);
      if (chained.length) {
        acceptedCandidates = chained;
        // حدّث driverQueue بإضافة السائقين المتسلسلين لضمان شفافية الواجهة
        const mergedQueue = Array.from(new Set([...(ride.driverQueue || []), ...chained.map((c) => c.driverId)]));
        try {
          await prisma.ride.update({ where: { id: ride.id }, data: { driverQueue: mergedQueue } });
          ride.driverQueue = mergedQueue;
        } catch (err) {
          console.warn(`Failed to persist chained driverQueue for ride ${ride.id}:`, err);
        }
      }
    }

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

  const existingCooldown = scheduledOfferCooldowns.get(ride.id);
  if (existingCooldown && existingCooldown > Date.now()) {
    return;
  }

  const previousQueueIds = normalizeDriverQueue(ride.driverQueue);

  const candidates = await buildScheduledCandidates(ride);
  if (!candidates.length) {
    console.log(`No eligible drivers for scheduled ride ${ride.id}`);
    return;
  }

  const mergedQueueIds = Array.from(new Set([...previousQueueIds, ...candidates.map((candidate) => candidate.driverId)]));

  try {
    await prisma.ride.update({
      where: { id: ride.id },
      data: {
        driverQueue: mergedQueueIds,
        driverId: null,
        car: null
      }
    });
    ride.driverQueue = mergedQueueIds;
    ride.driverId = null;
    ride.car = null;
  } catch (error) {
    console.warn(`Failed to persist scheduled offer queue for ride ${ride.id}:`, error);
  }

  const nowMs = Date.now();
  const rideData = {
    ...buildRidePayload(ride),
    scheduledOfferOnly: true
  };

  const offerState = {
    rideId: ride.id,
    pickupTime: ride.pickupTime,
    vehicleTypeId: ride.vehicleTypeId,
    candidates,
    accepted: new Map(),
    rejected: new Set(),
    createdAt: nowMs,
    timeoutMs: SCHEDULED_OFFER_TIMEOUT_MS,
    timerId: null,
    rideData
  };

  scheduledOffers.set(ride.id, offerState);

  emitScheduledUpcomingOffersUpdate(candidates.map((candidate) => candidate.driverId));

  for (const candidate of candidates) {
    try {
      await sendPushToDriver(
        candidate.driverId,
        'Scheduled ride offer',
        'A new scheduled ride offer is available in upcoming rides. You have 3 minutes to respond.',
        {
          type: 'scheduledRideOffer',
          rideId: ride.id,
          expiresAt: new Date(nowMs + SCHEDULED_OFFER_TIMEOUT_MS).toISOString(),
          pickupTime: ride.pickupTime ? new Date(ride.pickupTime).toISOString() : null
        }
      );
    } catch (error) {
      console.error(`Error sending scheduled ride offer push to driver ${candidate.driverId}:`, error);
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
    scheduledOfferCooldowns.set(rideId, Date.now() + 60 * 1000);
    emitScheduledUpcomingOffersUpdate(offerState.candidates.map((candidate) => candidate.driverId));
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
      if (!driver.isOnline) continue;
      if (driver.bannedUntil && driver.bannedUntil > now) {
        if (isDriverOfferRestrictedByBan(driver.bannedUntil, now)) {
          console.log(`Scheduled finalization skip driver ${candidate.driverId} due to short active ban restriction until ${driver.bannedUntil}`);
        }
        continue;
      }
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

  emitScheduledUpcomingOffersUpdate(offerState.candidates.map((candidate) => candidate.driverId));
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
  emitScheduledUpcomingOffersUpdate(offerState.candidates.map((candidate) => candidate.driverId));
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

    const etaWindows = new Set(availableDrivers.map((driver) => getEtaWindowKey(driver.timeMinutes)));
    if (etaWindows.size > 1) {
      availableDrivers.sort((a, b) => a.timeMinutes - b.timeMinutes);
    }

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
          if (isDriverOfferRestrictedByBan(driverData.bannedUntil, now)) {
            console.log(`Driver ${driver.driverId} has short ban (${driverData.bannedUntil}) - login allowed but offers restricted`);
          } else {
            console.log(`Driver ${driver.driverId} is banned until ${driverData.bannedUntil}`);
          }
          continue; // Driver cannot receive immediate offers while ban is active
        }

        // Check conditions: currentRideId = null, isOnline = 1, isBusy = 0
        if (driverData.currentRideId !== null || !driverData.isOnline || driverData.isBusy) {
          continue; // Driver not available
        }

        // Immediate rides: ignore configured schedule windows; require online + not busy + connected only.

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
                vehicleTypeId: ride.vehicleTypeId,
                paymentMethod: ride.paymentMethod
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
    let vehicleInfo = await getAvailableVehiclesForRide(ride);

    // If all currently excluded drivers were already tried, refresh candidates from strategy
    // to get the latest locations instead of waiting for rejection TTL expiry.
    const rejectedDrivers = global.rejectedRides?.get(rideId);
    if (vehicleInfo.length === 0 && rejectedDrivers && rejectedDrivers.size > 0) {
      console.log(
        `Ride ${rideId} exhausted current candidate list (${rejectedDrivers.size} rejected/timed out) - refreshing strategy candidates`
      );
      global.rejectedRides.delete(rideId);
      vehicleInfo = await getAvailableVehiclesForRide(ride);
    }

    if (vehicleInfo.length > 0) {
      await autoAssignRide(ride, vehicleInfo);
    } else {
      console.log(`No alternative drivers available for ride ${rideId} after strategy refresh`);
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
      select: { status: true, scheduled: true, pickupTime: true }
    });
    if (!ride || !['DISPATCHED', 'ONGOING', 'IN_PROGRESS'].includes(ride.status)) {
      return;
    }
    if (!canStartPickupCountdown(ride)) {
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

      const countdownTimeout = setTimeout(() => {
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
          expiredAt: Date.now(),
          timeoutId: undefined
        });
      }, PICKUP_COUNTDOWN_DURATION_SEC * 1000);

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
        expiredAt: null,
        timeoutId: countdownTimeout
      });
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
            expiredAt: Date.now(),
            timeoutId: undefined
          });
        }
      }
    }
  }
}

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

        const withinScheduledOfferWindow =
          minutesToPickup !== null &&
          minutesToPickup <= SCHEDULED_OFFER_WINDOW_MINUTES &&
          minutesToPickup > scheduledDispatchLeadMinutes;

        const withinScheduledStage2Window =
          minutesToPickup !== null &&
          minutesToPickup > SCHEDULED_OFFER_WINDOW_MINUTES &&
          minutesToPickup <= SCHEDULED_STAGE2_MAX_WINDOW_MINUTES;

        const withinScheduledStage3Window =
          minutesToPickup !== null &&
          minutesToPickup > SCHEDULED_STAGE2_MAX_WINDOW_MINUTES;

        if (withinScheduledStage3Window) {
          if (scheduledOffers.has(ride.id)) {
            continue;
          }

          if (!ride.driverId) {
            await broadcastScheduledRideOfferStage3(ride);
          }
          continue;
        }

        if (withinScheduledStage2Window) {
          if (scheduledOffers.has(ride.id)) {
            continue;
          }

          if (!ride.driverId) {
            await broadcastScheduledRideOfferStage2(ride);
          }
          continue;
        }

        if (withinScheduledOfferWindow) {
          if (scheduledOffers.has(ride.id)) {
            continue;
          }

          if (!ride.driverId) {
            await broadcastScheduledRideOffer(ride);
          }
          continue;
        }

        if (minutesToPickup !== null && minutesToPickup > scheduledDispatchLeadMinutes) {
          if (scheduledOffers.has(ride.id)) {
            continue;
          }

          if (!ride.driverId && minutesToPickup > SCHEDULED_OFFER_WINDOW_MINUTES) {
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

          if (!ride.driverId && minutesToPickup <= SCHEDULED_OFFER_WINDOW_MINUTES) {
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

          // لا نفك تعيين السائق المقبول للرحلة المجدولة إلا داخل دائرة الخطر
          // دائرة الخطر هنا: قبل ساعة من وقت الالتقاط (أو إذا وقت الالتقاط غير معروف)
          const shouldReleaseAssignedDriver =
            minutesToPickup === null || minutesToPickup <= SCHEDULED_OFFER_WINDOW_MINUTES;

          if (!shouldReleaseAssignedDriver) {
            console.log(
              `Keeping scheduled ride ${ride.id} assigned to driver ${ride.driverId} (outside danger window: ${minutesToPickup} min to pickup)`
            );
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
          // Use persisted queue before fallback assignment only outside the upcoming-offer window
          if (
            !ride.driverId &&
            minutesToPickup > SCHEDULED_OFFER_WINDOW_MINUTES &&
            normalizeDriverQueue(ride.driverQueue).length > 0
          ) {
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
          console.log(
            `Ride ${ride.id} has temporary rejected/timed-out drivers: ${Array.from(rejectedDrivers).join(', ')}`
          );
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
          let vehicleInfo = await getAvailableVehiclesForRide(ride);

          // Immediate rides: once the current strategy candidate list is exhausted,
          // refresh from strategy to use latest driver coordinates.
          if (!ride.scheduled && vehicleInfo.length === 0 && rejectedDrivers && rejectedDrivers.size > 0) {
            console.log(
              `Ride ${ride.id} exhausted current strategy candidates (${rejectedDrivers.size}) - requesting fresh candidates`
            );
            global.rejectedRides.delete(ride.id);
            vehicleInfo = await getAvailableVehiclesForRide(ride);
          }

          if (vehicleInfo.length > 0) {
            // For immediate rides: filter out drivers too far from pickup
            if (!ride.scheduled) {
              vehicleInfo = vehicleInfo.filter((info) => {
                const match = info.match(/\[(\d+),\s*(\d+),\s*(\d+|unknown)\]/);
                if (match) {
                  const etaMin = parseInt(match[3]);
                  if (!isNaN(etaMin) && etaMin > IMMEDIATE_MAX_PICKUP_ETA_MINUTES) {
                    console.log(`  Skipping vehicle ${match[1]} — ETA ${etaMin}min exceeds limit ${IMMEDIATE_MAX_PICKUP_ETA_MINUTES}min`);
                    return false;
                  }
                }
                return true;
              });
            }

            if (vehicleInfo.length > 0) {
              console.log(`Ride ${ride.id} will get one of these: ${vehicleInfo.join(', ')}`);
              await autoAssignRide(ride, vehicleInfo);
              continue;
            }
          }

          if (ride.scheduled && minutesToPickup !== null && minutesToPickup <= scheduledDispatchLeadMinutes) {
            console.log(`No vehicles available for scheduled ride ${ride.id} (${minutesToPickup} min) - canceling`);
            await cancelRideWithRefund(ride, { reason: 'No vehicles available for scheduled ride' });
          } else {
            console.log(`Ride ${ride.id} has not been offered to any driver yet (no vehicles available)`);
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
    const authToken = socket.handshake.auth?.token;
    if (!authToken) {
      console.log('Connection rejected: missing token');
      socket.disconnect();
      return;
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authToken, SOCKET_JWT_SECRET);
      socket.data = socket.data || {};
      const resolvedDriverId = decoded?.driverId || (decoded?.type === 'driver' ? decoded?.id : null);
      socket.data.userId = decoded?.id || decoded?.userId || decoded?.sub || null;
      socket.data.driverId = resolvedDriverId || null;
    } catch (error) {
      console.log('Connection rejected: invalid token', error.message);
      socket.disconnect();
      return;
    }

    console.log('Client connected:', socket.id);

    socket.on('join', async (data) => {
      const authDriverId = socket.data?.driverId;

      if (!authDriverId) {
        console.log('Join rejected: driverId missing in token');
        socket.disconnect();
        return;
      }

      if (data?.driverId && Number(data.driverId) !== Number(authDriverId)) {
        console.log('Join rejected: driverId mismatch between token and payload');
        socket.disconnect();
        return;
      }

      if (data?.vehicleTypeId) {
        const driverId = Number(authDriverId);
        socket.join(`driver_${driverId}`);
        console.log(`Driver ${driverId} joined room with vehicle type ${data.vehicleTypeId}`);

        try {
          const driverBanStatus = await prisma.comDriver.findUnique({
            where: { id: driverId },
            select: { bannedUntil: true }
          });
          const now = new Date();
          const isRestricted = !!(
            driverBanStatus?.bannedUntil &&
            driverBanStatus.bannedUntil > now &&
            isDriverOfferRestrictedByBan(driverBanStatus.bannedUntil, now)
          );
          if (isRestricted) {
            socket.emit('driverStatusUpdate', {
              restrictedOffers: true,
              restrictedOffersUntil: driverBanStatus.bannedUntil.toISOString(),
              bannedUntil: driverBanStatus.bannedUntil.toISOString(),
              timestamp: Date.now()
            });
          }
        } catch (banStatusError) {
          console.error('Error checking driver ban status on join:', banStatusError);
        }

        // Add to connected drivers
        connectedDrivers.set(driverId, {
          socketId: socket.id,
          location: data.location || null,
          lastUpdate: Date.now(),
          vehicleTypeId: data.vehicleTypeId
        });

        console.log(`Connected drivers now: ${Array.from(connectedDrivers.keys()).join(', ')}`);

        // Update driver status in database once
        try {
          await prisma.comDriver.update({
            where: { id: driverId },
            data: { isOnline: true, isBusy: false }
          });
          invalidateDriverScheduleCache(driverId);
          console.log(`Driver ${driverId} status updated to online`);
          emitScheduledUpcomingOffersUpdate([driverId]);
        } catch (error) {
          console.error('Error updating driver status:', error);
        }

        // Check if driver has an ongoing ride with expired pickup countdown
        try {
          const driver = await prisma.comDriver.findUnique({
            where: { id: driverId },
            select: { currentRideId: true }
          });

          if (driver && driver.currentRideId) {
            const ride = await prisma.ride.findUnique({
              where: { id: driver.currentRideId },
              select: { id: true, status: true, driverId: true }
            });

            if (ride && (ride.status === 'ONGOING' || ride.status === 'DISPATCHED')) {
              const proximityKey = `${ride.id}_${driverId}`;
              if (pickupProximitySent.has(proximityKey)) {
                const proximityData = pickupProximitySent.get(proximityKey);
                if (proximityData && proximityData.countdownStart) {
                  const duration = proximityData.countdownDuration || PICKUP_COUNTDOWN_DURATION_SEC;
                  const elapsed = Math.floor((Date.now() - proximityData.countdownStart) / 1000);
                  if (elapsed >= duration) {
                    // Countdown already expired, send expired event
                    socket.emit('pickupCountdownExpired', { rideId: ride.id });
                    console.log(`Sent pickupCountdownExpired on reconnect to driver ${driverId} for ride ${ride.id}`);
                  } else {
                    socket.emit('pickupProximity', {
                      rideId: ride.id,
                      distanceMeters: proximityData.distanceMeters ?? 0,
                      countdownStart: proximityData.countdownStart,
                      countdownDuration: duration
                    });
                    console.log(`Re-sent pickupProximity on reconnect to driver ${driverId} for ride ${ride.id}`);
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
      const authDriverId = socket.data?.driverId;
      if (!authDriverId) return;
      if (data.driverId && data.driverId !== authDriverId) {
        console.log(`Ignoring updateLocation for mismatched driverId. token driver: ${authDriverId}, payload driver: ${data.driverId}`);
        return;
      }
      if (!connectedDrivers.has(authDriverId)) return;
      connectedDrivers.get(authDriverId).location = data.location;
      connectedDrivers.get(authDriverId).lastUpdate = Date.now();
      console.log(`Driver ${authDriverId} location updated:`, data.location);

      try {
          const driver = await prisma.comDriver.findUnique({
            where: { id: authDriverId },
            select: { car: true, currentRideId: true }
          });

        if (driver?.car) {
          const vehicle = await prisma.comVehicles.findFirst({
            where: { regNumber: driver.car }
          });

          if (vehicle) {
            await prisma.comVehicles.update({
              where: { id: vehicle.id },
              data: {
                lastLat: data.location.lat,
                lastLon: data.location.lng,
                lastLocationUpdate: new Date()
              }
            });

              await prisma.comDriver.update({
                where: { id: authDriverId },
                data: {
                  lastLocation: [data.location.lat, data.location.lng]
                }
              });

            if (driver.currentRideId) {
              const ride = await prisma.ride.findUnique({
                where: { id: driver.currentRideId },
                select: { startLatLon: true, status: true, scheduled: true, pickupTime: true }
              });

              let eta = null;
              if (ride?.startLatLon && (ride.status === 'ONGOING' || ride.status === 'IN_PROGRESS' || ride.status === 'DISPATCHED')) {
                eta = await calculateETA(data.location, ride.startLatLon.lat, ride.startLatLon.lon);
              }

              const driverInfo = await prisma.comDriver.findUnique({
                where: { id: authDriverId },
                select: {
                  id: true,
                  drFname: true,
                  drLname: true,
                  car: true
                }
              });

               io.to(`booking_${driver.currentRideId}`).emit('driverInfoUpdate', {
                 bookingId: driver.currentRideId,
                 driverId: authDriverId,
                driver: driverInfo,
                location: data.location,
                eta: eta,
                timestamp: new Date().toISOString()
              });

               if (ride?.startLatLon && (ride.status === 'ONGOING' || ride.status === 'DISPATCHED')) {
                 await maybeSendPickupProximity(driver.currentRideId, authDriverId, data.location, ride.startLatLon);
               }
             }
           }
         }
       } catch (error) {
        console.error('Error updating location in database:', error);
      }
    });

    socket.on('acceptRide', async (data) => {
      const authDriverId = Number(socket.data?.driverId);
      const requestedDriverId = Number(data?.driverId);

      if (!Number.isFinite(authDriverId) || authDriverId <= 0) {
        socket.emit('rideAcceptFailed', { rideId: data?.rideId, reason: 'Unauthorized driver' });
        return;
      }

      if (Number.isFinite(requestedDriverId) && requestedDriverId > 0 && requestedDriverId !== authDriverId) {
        console.warn(
          `Rejecting acceptRide for mismatched driverId. token driver: ${authDriverId}, payload driver: ${requestedDriverId}`
        );
        socket.emit('rideAcceptFailed', { rideId: data?.rideId, reason: 'Unauthorized driver' });
        return;
      }

      const driverId = authDriverId;

      try {
        console.log(`Driver ${driverId} accepted ride ${data.rideId}`);

        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          const candidate = scheduledOffer.candidates.find((c) => c.driverId === driverId);
          if (!candidate) {
            socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Driver not eligible for scheduled ride' });
            return;
          }

          if (Number(scheduledOffer.stage) === 3) {
            const activeDriverId = Number(scheduledOffer.activeDriverId);
            if (!Number.isFinite(activeDriverId) || activeDriverId !== driverId) {
              socket.emit('rideAcceptFailed', {
                rideId: data.rideId,
                reason: 'Scheduled offer is currently assigned to another driver',
                stage: 3
              });
              return;
            }
          }

          const scheduledCheckAt = scheduledOffer.pickupTime
            ? new Date(scheduledOffer.pickupTime)
            : new Date();
          const scheduledEligibility = await canDriverReceiveRide(prisma, driverId, {
            // Scheduled offer acceptance validates pickup-time window membership.
            strict: false,
            now: scheduledCheckAt
          });
          if (!scheduledEligibility?.eligible) {
            socket.emit('rideAcceptFailed', {
              rideId: data.rideId,
              reason: 'Driver is outside configured work schedule'
            });
            return;
          }

          if (scheduledOffer.rejected?.has?.(driverId)) {
            scheduledOffer.rejected.delete(driverId);
          }

          scheduledOffer.accepted.set(driverId, {
            driverId,
            distanceKm: candidate.distanceKm,
            etaMinutes: candidate.etaMinutes,
            rating: candidate.rating,
            vehicleTypeId: candidate.vehicleTypeId,
            car: candidate.car,
            chainPriority: Boolean(candidate.chainPriority),
            chainGapMinutes: candidate.chainGapMinutes ?? null,
            chainEtaMinutes: candidate.chainEtaMinutes ?? null,
            threshold: Number.isFinite(candidate.threshold) ? candidate.threshold : null,
            pricePerHour: Number.isFinite(candidate.pricePerHour) ? candidate.pricePerHour : null,
            totalMinutes: Number.isFinite(candidate.totalMinutes) ? candidate.totalMinutes : null,
            stage: Number(scheduledOffer.stage || 1),
            acceptedAt: Date.now()
          });

          try {
            const existingQueue = await prisma.ride.findUnique({
              where: { id: data.rideId },
              select: { driverQueue: true }
            });
            const queueIds = normalizeDriverQueue(existingQueue?.driverQueue);
            if (!queueIds.includes(driverId)) {
              queueIds.push(driverId);
              await prisma.ride.update({
                where: { id: data.rideId },
                data: { driverQueue: queueIds }
              });
            }
            // Also set driverId/car on the ride so it appears in upcoming rides lists
            if (candidate.car) {
              await prisma.ride.update({
                where: { id: data.rideId, driverId: null },
                data: { driverId, car: candidate.car }
              });
            }
          } catch (error) {
            console.error(`Failed to persist scheduled acceptance for ride ${data.rideId}:`, error);
          }

          socket.emit('scheduledOfferAcknowledged', {
            rideId: data.rideId,
            stage: Number(scheduledOffer.stage || 1)
          });
          emitScheduledUpcomingOffersUpdate([driverId]);

          if (Number(scheduledOffer.stage) === 3) {
            advanceScheduledStage3Offer(data.rideId, 'accepted').catch((error) => {
              console.error(`Error advancing stage3 offer after acceptance for ride ${data.rideId}:`, error);
            });
          }
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

        if (global.activeOffers.has(data.rideId) && global.activeOffers.get(data.rideId) !== driverId) {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Ride already offered to another driver' });
          return;
        }

        // Get driver info
        const driver = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: {
            id: true, drFname: true, drLname: true, car: true, drPhone: true,
            currentRideId: true, isOnline: true, isBusy: true,
          },
        });

        if (!driver) {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Driver not found' });
          return;
        }

        if (!ride.scheduled) {
          let driverPickupEtaMinutes = 0;
          const driverLocation = await resolveDriverLocation(driverId);
          if (driverLocation && ride.startLatLon) {
            const eta = await calculateETA(driverLocation, ride.startLatLon.lat, ride.startLatLon.lon);
            if (eta && Number.isFinite(eta.timeMinutes)) {
              driverPickupEtaMinutes = eta.timeMinutes;
            }
          }

          const scheduledCheck = await canDriverAcceptImmediateRide(
            driverId,
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

        // Assign ride + driver atomically to reduce race conditions
        const txNow = new Date();
        try {
          await prisma.$transaction(async (tx) => {
            const rideUpdated = await tx.ride.updateMany({
              where: {
                id: data.rideId,
                status: 'CONFIRMED',
                driverId: null
              },
              data: {
                driverId,
                car: driver.car || null,
                status: 'DISPATCHED',
                acceptedAt: txNow
              }
            });

            if (rideUpdated.count !== 1) {
              throw new Error('RIDE_NOT_AVAILABLE');
            }

            const driverUpdated = await tx.comDriver.updateMany({
              where: {
                id: driverId,
                isOnline: true,
                isBusy: false,
                currentRideId: null,
                OR: [{ bannedUntil: null }, { bannedUntil: { lte: txNow } }]
              },
              data: {
                currentRideId: data.rideId,
                rideAccepted: 1,
                isBusy: true
              }
            });

            if (driverUpdated.count !== 1) {
              throw new Error('DRIVER_NOT_AVAILABLE');
            }
          });
        } catch (txError) {
          const txMessage = String(txError?.message || '');
          if (txMessage === 'RIDE_NOT_AVAILABLE' || txMessage === 'DRIVER_NOT_AVAILABLE') {
            socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Ride not available' });
            return;
          }
          throw txError;
        }

        // Clear active offer
        global.activeOffers.delete(data.rideId);

        // Clear pickup proximity sent
        const proximityKey = `${data.rideId}_${driverId}`;
        if (global.pickupProximitySent.has(proximityKey)) {
          global.pickupProximitySent.delete(proximityKey);
          console.log(`Cleared pickup proximity for accepted ride ${data.rideId}, driver ${driverId}`);
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
          driverId,
          driver: driver,
          timestamp: new Date().toISOString()
        });

        // WhatsApp notification: driver accepted with ETA
        console.log(`[WA Notify] Attempting notification for ride #${data.rideId}, driver ${driverId}`);
        try {
          const rideForNotif = await prisma.ride.findUnique({
            where: { id: data.rideId },
            select: { id: true, pickupAddress: true, dropoffAddress: true, userId: true, startLatLon: true },
          });
          console.log(`[WA Notify] rideForNotif found:`, !!rideForNotif, 'userId:', rideForNotif?.userId);
          if (rideForNotif) {
            const user = await prisma.user.findUnique({
              where: { id: rideForNotif.userId },
              select: { phone: true, firstName: true },
            });
            console.log(`[WA Notify] user found:`, !!user, 'phone:', user?.phone);
            if (user?.phone) {
              const driverName = `${driver.drFname || ''} ${driver.drLname || ''}`.trim() || 'Driver';
              const carInfo = driver.car || 'N/A';

              // Calculate ETA
              let etaMinutes = 0;
              const driverLocation = connectedDrivers.get(driverId)?.location;
              if (driverLocation && rideForNotif.startLatLon) {
                try {
                  const eta = await calculateETA(
                    { lat: driverLocation.lat, lon: driverLocation.lng },
                    rideForNotif.startLatLon.lat,
                    rideForNotif.startLatLon.lon
                  );
                  if (eta && Number.isFinite(eta.timeMinutes)) {
                    etaMinutes = Math.round(eta.timeMinutes);
                  }
                } catch {}
              }

              const etaText = etaMinutes > 0 ? `\n⏱ ETA: ~${etaMinutes} min` : '';
              const msg = `🚕 *Driver assigned!*\n\nDriver: ${driverName}\nCar: ${carInfo}${etaText}\n📋 Ride #${rideForNotif.id}\n📍 ${rideForNotif.pickupAddress} → ${rideForNotif.dropoffAddress}\n\nThe driver is on the way.\n\n💬 *Chat with your driver:*\nYou can now send messages here — they will be forwarded to your driver. Simply reply to this chat. To end the chat, send "endchat".`;

              const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
              const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
              console.log(`[WA Notify] Creds: phoneId=${!!phoneId}, token=${!!token}`);
              if (phoneId && token) {
                const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: user.phone, type: 'text', text: { preview_url: false, body: msg } }),
                });
                if (!res.ok) console.error('[WA Notify] Failed:', res.status, await res.text().catch(() => ''));
                else console.log(`[WA Notify] Sent to ${user.phone} for ride #${data.rideId}`);
              } else {
                console.log('[WA Notify] No creds available — skipping');
              }
            } else {
              console.log('[WA Notify] No user phone found — skipping');
            }
          } else {
            console.log('[WA Notify] rideForNotif not found — skipping');
          }
        } catch (waErr) { console.error('[WA Notify] Accept error:', waErr); }

        // Send initial driver info update
        const driverInfo = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: {
            id: true,
            drFname: true,
            drLname: true,
            car: true
          }
        });

        io.to(`booking_${data.rideId}`).emit('driverInfoUpdate', {
          bookingId: data.rideId,
          driverId,
          driver: driverInfo,
          location: null,
          eta: null,
          timestamp: new Date().toISOString()
        });

        // Also send SSE update
        realtimeService.sendBookingUpdate(data.rideId, {
          bookingId: data.rideId,
          status: 'DISPATCHED',
          driverId,
          driver: driver,
          timestamp: new Date().toISOString()
        });

        console.log(`Ride ${data.rideId} assigned to driver ${driverId}`);

      } catch (error) {
        console.error('Error accepting ride:', error);
        socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Server error' });
      }
    });

    socket.on('rejectRide', async (data) => {
      const authDriverId = Number(socket.data?.driverId);
      const requestedDriverId = Number(data?.driverId);

      if (!Number.isFinite(authDriverId) || authDriverId <= 0) {
        return;
      }

      if (Number.isFinite(requestedDriverId) && requestedDriverId > 0 && requestedDriverId !== authDriverId) {
        console.warn(
          `Rejecting rejectRide payload driverId mismatch. token driver: ${authDriverId}, payload driver: ${requestedDriverId}`
        );
        return;
      }

      const driverId = authDriverId;

      console.log(`Driver ${driverId} rejected ride ${data.rideId}`);
      try {
        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          const isStage3 = Number(scheduledOffer.stage) === 3;
          if (isStage3) {
            const activeDriverId = Number(scheduledOffer.activeDriverId);
            if (Number.isFinite(activeDriverId) && activeDriverId > 0 && activeDriverId !== driverId) {
              return;
            }
          }

          if (scheduledOffer.accepted?.has?.(driverId)) {
            scheduledOffer.accepted.delete(driverId);
          }
          scheduledOffer.rejected.add(driverId);

          if (isStage3) {
            scheduledOffer.currentIndex = Math.max(Number(scheduledOffer.currentIndex || 0) + 1, 1);
            scheduledOffer.activeDriverId = null;
            advanceScheduledStage3Offer(data.rideId, 'rejected').catch((error) => {
              console.error(`Error advancing stage3 offer after rejection for ride ${data.rideId}:`, error);
            });
          }

          socket.emit('rideOfferRejected', {
            rideId: data.rideId,
            stage: Number(scheduledOffer.stage || 1)
          });
          emitScheduledUpcomingOffersUpdate([driverId]);
          return;
        }
        // Clear currentRideId and ban driver for 2 minutes
        const proposedBannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
        const bannedUntil = await getMergedBanUntil(driverId, proposedBannedUntil);
        await prisma.comDriver.update({
          where: { id: driverId },
          data: {
            currentRideId: null,
            bannedUntil,
            rideAccepted: 0,
            isBusy: false
          }
        });
        invalidateDriverScheduleCache(driverId);
        console.log(`Banned driver ${driverId} until ${bannedUntil} after ride rejection`);

        // Send status update to driver app
        socket.emit('driverStatusUpdate', {
          currentRideId: null,
          bannedUntil: bannedUntil.toISOString(),
          rideAccepted: null
        });

        // Auto-unban after 2 minutes (if no longer banned)
        scheduleAutoUnban(driverId, 120000);
      } catch (error) {
        console.error(`Error updating driver ${driverId} after rejection:`, error);
      }

      // Add to rejected rides to avoid re-offering
      if (!global.rejectedRides.has(data.rideId)) {
        global.rejectedRides.set(data.rideId, new Set());
      }
      global.rejectedRides.get(data.rideId).add(driverId);

      // Set timeout to remove rejection after 30 seconds for each driver
      const timeoutMs = 30000; // 30 seconds
      setTimeout(() => {
        if (global.rejectedRides.has(data.rideId)) {
          global.rejectedRides.get(data.rideId).delete(driverId);
          if (global.rejectedRides.get(data.rideId).size === 0) {
            global.rejectedRides.delete(data.rideId);
          }
        }
      }, timeoutMs);

      // Clear active offer
      global.activeOffers.delete(data.rideId);

      // Clear pickup proximity sent
      const proximityKey = `${data.rideId}_${driverId}`;
      if (global.pickupProximitySent.has(proximityKey)) {
        global.pickupProximitySent.delete(proximityKey);
        console.log(`Cleared pickup proximity for rejected ride ${data.rideId}, driver ${driverId}`);
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
      const authDriverId = Number(socket.data?.driverId);
      const requestedDriverId = Number(data?.driverId);

      if (!Number.isFinite(authDriverId) || authDriverId <= 0) {
        return;
      }

      if (Number.isFinite(requestedDriverId) && requestedDriverId > 0 && requestedDriverId !== authDriverId) {
        console.warn(
          `Rejecting rideTimeout payload driverId mismatch. token driver: ${authDriverId}, payload driver: ${requestedDriverId}`
        );
        return;
      }

      const driverId = authDriverId;

      console.log(`Driver ${driverId} timed out on ride ${data.rideId}`);
      try {
        const scheduledOffer = scheduledOffers.get(data.rideId);
        if (scheduledOffer) {
          const isStage3 = Number(scheduledOffer.stage) === 3;
          if (isStage3) {
            const activeDriverId = Number(scheduledOffer.activeDriverId);
            if (Number.isFinite(activeDriverId) && activeDriverId > 0 && activeDriverId !== driverId) {
              return;
            }
          }

          if (scheduledOffer.accepted?.has?.(driverId)) {
            scheduledOffer.accepted.delete(driverId);
          }
          scheduledOffer.rejected.add(driverId);

          if (isStage3) {
            scheduledOffer.currentIndex = Math.max(Number(scheduledOffer.currentIndex || 0) + 1, 1);
            scheduledOffer.activeDriverId = null;
            advanceScheduledStage3Offer(data.rideId, 'timeout').catch((error) => {
              console.error(`Error advancing stage3 offer after timeout for ride ${data.rideId}:`, error);
            });
          }

          socket.emit('rideOfferTimeout', {
            rideId: data.rideId,
            stage: Number(scheduledOffer.stage || 1)
          });
          emitScheduledUpcomingOffersUpdate([driverId]);
          return;
        }
        // Reset driver status and ban for 2 minutes
        const proposedBannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
        const bannedUntil = await getMergedBanUntil(driverId, proposedBannedUntil);
        await prisma.comDriver.update({
          where: { id: driverId },
          data: {
            currentRideId: null,
            bannedUntil,
            isBusy: false
          }
        });
        invalidateDriverScheduleCache(driverId);

        // Add to rejected rides to avoid re-offering
        if (!global.rejectedRides.has(data.rideId)) {
          global.rejectedRides.set(data.rideId, new Set());
        }
        global.rejectedRides.get(data.rideId).add(driverId);

        // Set timeout to remove rejection after 30 seconds
        const timeoutMs = 30000; // 30 seconds
        setTimeout(() => {
          if (global.rejectedRides.has(data.rideId)) {
            global.rejectedRides.get(data.rideId).delete(driverId);
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
        const proximityKey = `${data.rideId}_${driverId}`;
        if (global.pickupProximitySent.has(proximityKey)) {
          global.pickupProximitySent.delete(proximityKey);
          console.log(`Cleared pickup proximity for timed out ride ${data.rideId}, driver ${driverId}`);
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

        console.log(`Driver ${driverId} banned until ${bannedUntil} after ride timeout`);

        // Auto-unban after 2 minutes (if no longer banned)
        scheduleAutoUnban(driverId, 120000);

        // Try to reassign to another driver
        setTimeout(() => reassignRide(data.rideId), 1000);
      } catch (error) {
        console.error('Error resetting driver status after timeout:', error);
      }
    });

    // Chat functionality
    socket.on('joinChat', async (data) => {
      if (!data?.bookingId) return;
      const authorized = await canAccessBooking(data.bookingId, socket);
      if (!authorized) {
        console.log(`Unauthorized chat join attempt for booking ${data.bookingId}`);
        socket.emit('error', { type: 'unauthorized_chat', message: 'Not allowed to join this chat' });
        return;
      }
      socket.join(`chat_${data.bookingId}`);
      console.log(`User joined chat for booking ${data.bookingId}`);
    });

    // Booking updates functionality
    socket.on('joinBooking', async (data) => {
      if (!data?.bookingId) return;
      const authorized = await canAccessBooking(data.bookingId, socket);
      if (!authorized) {
        console.log(`Unauthorized booking join attempt for booking ${data.bookingId}`);
        socket.emit('error', { type: 'unauthorized_booking', message: 'Not allowed to join this booking' });
        return;
      }
      socket.join(`booking_${data.bookingId}`);
      console.log(`User joined booking updates for booking ${data.bookingId}`);
    });

    socket.on('sendMessage', async (data) => {
      const bookingId = Number(data?.bookingId);
      const message = typeof data?.message === 'string' ? data.message.trim() : '';
      const sender = typeof data?.sender === 'string' ? data.sender.trim() : '';
      if (!Number.isInteger(bookingId) || bookingId <= 0 || !message || message.length > 1000 || !sender || sender.length > 80) {
        socket.emit('error', { type: 'invalid_chat_payload', message: 'Invalid chat message payload' });
        return;
      }
      const authorized = await canAccessBooking(bookingId, socket);
      if (!authorized) {
        console.log(`Unauthorized sendMessage attempt for booking ${bookingId}`);
        socket.emit('error', { type: 'unauthorized_chat', message: 'Not allowed to send messages to this chat' });
        return;
      }
      const messageData = {
        bookingId,
        message,
        sender,
        timestamp: new Date().toISOString()
      };
      io.to(`chat_${bookingId}`).emit('newMessage', messageData);
      console.log(`Message sent in chat ${bookingId}`);

      // Persist message to DB
      try {
        await prisma.chatMessage.create({
          data: {
            rideId: bookingId,
            sender: sender,
            message: message,
            source: 'socket',
          }
        });

        // If sender is driver, also notify rider via WhatsApp
        if (sender === 'driver' || sender.startsWith('Driver')) {
          const ride = await prisma.ride.findUnique({
            where: { id: bookingId },
            select: { userId: true },
          });
          if (ride) {
            const user = await prisma.user.findUnique({
              where: { id: ride.userId },
              select: { phone: true },
            });
            if (user?.phone) {
              const waMsg = `💬 *Message from driver:*\n\n"${message}"\n\n📋 Ride #${bookingId}\n\nReply to this chat to message the driver. Send "endchat" to stop.`;
              const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
              const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
              if (phoneId && token) {
                await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: user.phone, type: 'text', text: { preview_url: false, body: waMsg } }),
                }).catch(() => {});
              }
            }
          }
        }
      } catch (e) {
        console.error('[Chat] DB persist failed:', e);
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

    try {
      await ensureDriverScheduleTables(prisma);
      console.log('Driver schedule tables are ready');
    } catch (scheduleError) {
      console.error('Failed to ensure driver schedule tables:', scheduleError);
    }

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

    // ===== Ride Reminders ====
    async function checkRideReminders() {
      try {
        const now = new Date();
        const windowStart = new Date(now.getTime() + 14 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);

        const rides = await prisma.ride.findMany({
          where: {
            status: 'CONFIRMED',
            scheduled: true,
            pickupTime: { gte: windowStart, lte: windowEnd },
          },
          select: { id: true, pickupTime: true, userId: true, explanation: true },
        });

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

            const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
            const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
            if (phoneId && token) {
              await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: user.phone, type: 'text', text: { preview_url: false, body: msg } }),
              }).catch(() => {});
            }

            await prisma.ride.update({
              where: { id: ride.id },
              data: { explanation: `[REMINDED] ${ride.explanation || ''}` },
            });

            console.log(`[Reminder] Sent to booking #${ride.id}`);
          } catch (e) {
            console.error(`[Reminder] Error for ride #${ride.id}:`, e);
          }
        }
      } catch (e) {
        console.error('[Reminder] Check failed:', e);
      }
    }

    // Check ride reminders every 45 seconds
    setInterval(checkRideReminders, 45000);

    // Check scheduled ride late warnings every 20 seconds
    setInterval(() => {
      if (global.checkScheduledLateWarnings) {
        global.checkScheduledLateWarnings();
      }
    }, 20000);

    // Check shift violations every hour
    setInterval(() => {
      checkShiftViolations();
    }, 3600000);
  });
});
