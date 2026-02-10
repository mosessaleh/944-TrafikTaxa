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
const { Expo, ExpoPushMessage, ExpoPushToken } = require('expo-server-sdk');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// In-memory storage for rejected rides
const rejectedRides = new Map(); // rideId -> Set of driverIds who rejected
global.rejectedRides = rejectedRides;

// In-memory storage for active ride offers
const activeOffers = new Map(); // rideId -> driverId currently being offered
global.activeOffers = activeOffers;

// In-memory storage for pickup proximity notifications sent
const pickupProximitySent = new Map(); // rideId_driverId -> { driverId, sentAt, countdownStart, countdownDuration, distanceMeters }
global.pickupProximitySent = pickupProximitySent;

const PICKUP_PROXIMITY_THRESHOLD_METERS = 30;
const PICKUP_COUNTDOWN_DURATION_SEC = 300;

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

        // Assign the ride
        await prisma.comDriver.update({
          where: { id: driver.driverId },
          data: {
            currentRideId: ride.id,
            isBusy: true
          }
        });

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

            io.to(`driver_${driver.driverId}`).emit('rideOffer', rideOfferData);
            console.log(`Ride ${ride.id} assigned to driver ${driver.driverId} (${driver.timeMinutes} minutes away)`);
            console.log('Sent rideOffer data:', rideOfferData);
            console.log(`Driver ${driver.driverId} is connected and should receive the offer`);

            // Send push notification to driver
            await sendPushToDriver(driver.driverId, 'New Ride Available!', `Pickup: ${ride.pickupAddress} → Dropoff: ${ride.dropoffAddress}`, {
              type: 'newRide',
              rideId: ride.id
            });

            // Mark as active offer
            global.activeOffers.set(ride.id, driver.driverId);
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

    const newRides = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED',
        car: null,
        driverId: null,
        paymentMethod: {
          not: null
        }
      },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        price: true,
        createdAt: true,
        distanceKm: true,
        riderName: true,
        startLatLon: true,
        endLatLon: true,
        vehicleTypeId: true
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
          const decoded = jwt.verify(socket.handshake.auth.token, process.env.AUTH_SECRET || 'change_me_dev_secret');
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

        // Check if ride is still available
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          include: { vehicleType: true }
        });

        if (!ride || ride.driverId || ride.status !== 'CONFIRMED') {
          socket.emit('rideAcceptFailed', { rideId: data.rideId, reason: 'Ride not available' });
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

        // Assign ride to driver
        await prisma.ride.update({
          where: { id: data.rideId },
          data: {
            driverId: data.driverId,
            car: driver.car || null,
            status: 'ONGOING',
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
          status: 'ONGOING',
          timestamp: new Date().toISOString()
        });

        // Notify passenger of booking update
        io.to(`booking_${data.rideId}`).emit('bookingUpdate', {
          bookingId: data.rideId,
          status: 'ONGOING',
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
          status: 'ONGOING',
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
        // Clear currentRideId and ban driver for 2 minutes
        const bannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
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

        // Auto-unban after 2 minutes
        setTimeout(async () => {
          try {
            await prisma.comDriver.update({
              where: { id: data.driverId },
              data: {
                bannedUntil: null
              }
            });
            console.log(`Unbanned driver ${data.driverId} after 2 minutes`);
          } catch (error) {
            console.error(`Error unbanning driver ${data.driverId}:`, error);
          }
        }, 120000); // 2 minutes
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
        // Reset driver status and ban for 2 minutes
        const bannedUntil = new Date(Date.now() + 120000); // 2 minutes from now
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

        // Send timeout event to stop the sound and clear offer
        socket.emit('rideOfferTimeout', {
          rideId: data.rideId
        });

        console.log(`Driver ${data.driverId} banned until ${bannedUntil} after ride timeout`);

        // Auto-unban after 2 minutes
        setTimeout(async () => {
          try {
            await prisma.comDriver.update({
              where: { id: data.driverId },
              data: {
                bannedUntil: null
              }
            });
            console.log(`Unbanned driver ${data.driverId} after 2 minutes`);
          } catch (error) {
            console.error(`Error unbanning driver ${data.driverId}:`, error);
          }
        }, 120000); // 2 minutes

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
  });
});
