const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { sendPushToDriver } = require('../lib/notification-service');

const prisma = new PrismaClient();

let io;

function initSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001", "exp://localhost:8081"],
      methods: ["GET", "POST"]
    }
  });

  // Store active drivers with their locations
  const activeDrivers = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Driver connects
    socket.on('driver-connect', (data) => {
      const { driverId, lat, lon } = data;
      activeDrivers.set(driverId, {
        socketId: socket.id,
        lat,
        lon,
        lastUpdate: Date.now()
      });
      console.log(`Driver ${driverId} connected with ${activeDrivers.size} active drivers`);
    });

    // Driver location update
    socket.on('driver-location', (data) => {
      const { driverId, lat, lon } = data;
      if (activeDrivers.has(driverId)) {
        activeDrivers.set(driverId, {
          ...activeDrivers.get(driverId),
          lat,
          lon,
          lastUpdate: Date.now()
        });
      }
    });

    // Driver disconnect
    socket.on('driver-disconnect', (driverId) => {
      activeDrivers.delete(driverId);
      console.log(`Driver ${driverId} disconnected, ${activeDrivers.size} active drivers remaining`);
    });

    // Listen for new bookings
    socket.on('listen-bookings', () => {
      // This will be triggered when a new booking is created
    });

    socket.on('disconnect', () => {
      // Remove driver from active list
      for (const [driverId, data] of activeDrivers.entries()) {
        if (data.socketId === socket.id) {
          activeDrivers.delete(driverId);
          console.log(`Driver ${driverId} disconnected, ${activeDrivers.size} active drivers remaining`);
          break;
        }
      }
    });
  });

  // Function to find nearest driver
  function findNearestDriver(pickupLat, pickupLon) {
    let nearestDriver = null;
    let minDistance = Infinity;

    for (const [driverId, driverData] of activeDrivers.entries()) {
      const distance = calculateDistance(pickupLat, pickupLon, driverData.lat, driverData.lon);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDriver = { driverId, ...driverData, distance };
      }
    }

    return nearestDriver;
  }

  // Haversine distance calculation
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Function to send ride to driver
  function sendRideToDriver(bookingId, driverId, rideData) {
    const driver = activeDrivers.get(driverId);
    if (driver) {
      io.to(driver.socketId).emit('new-ride', { bookingId, ...rideData });

      // Send push notification to driver
      sendPushToDriver(driverId, 'New Ride Available', `You have a new ride request from ${rideData.pickupAddress} to ${rideData.dropoffAddress}.`, {
        bookingId,
        ...rideData
      }).catch(error => console.error('Failed to send push notification to driver:', error));

      return true;
    }
    return false;
  }

  // Function to notify all drivers of new booking
  async function notifyNewBooking(booking) {
    // Find nearest available driver
    const nearestDriver = findNearestDriver(booking.startLatLon.lat, booking.startLatLon.lon);

    if (nearestDriver) {
      const sent = sendRideToDriver(booking.id, nearestDriver.driverId, {
        pickupAddress: booking.pickupAddress,
        dropoffAddress: booking.dropoffAddress,
        price: booking.price,
        distanceKm: booking.distanceKm,
        riderName: booking.riderName,
        startLatLon: booking.startLatLon,
        endLatLon: booking.endLatLon
      });

      if (sent) {
        console.log(`Sent ride ${booking.id} to driver ${nearestDriver.driverId} (${nearestDriver.distance.toFixed(2)}km away)`);
      }
    } else {
      console.log('No active drivers available for booking', booking.id);
    }
  }

  // Export functions for use in API routes
  return {
    notifyNewBooking,
    getActiveDriversCount: () => activeDrivers.size,
    getActiveDrivers: () => Array.from(activeDrivers.entries()).map(([id, data]) => ({ driverId: id, ...data }))
  };
}

module.exports = { initSocketServer };