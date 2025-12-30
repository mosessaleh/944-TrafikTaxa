const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { setSocketServer } = require('./lib/socket-server');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// In-memory storage for connected drivers
const connectedDrivers = new Map(); // driverId -> { socketId, location: { lat, lng }, lastUpdate, vehicleTypeId }

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);
  setSocketServer(io);

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
        console.log(`Driver ${data.driverId} joined room`);

        // Add to connected drivers
        connectedDrivers.set(data.driverId, {
          socketId: socket.id,
          location: data.location || null,
          lastUpdate: Date.now(),
          vehicleTypeId: data.vehicleTypeId
        });

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
            select: { car: true }
          });

          if (driver && driver.car) {
            const vehicle = await prisma.comVehicles.findFirst({
              where: { regNumber: driver.car.regNumber }
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
          include: { car: true }
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
            car: driver.car?.regNumber || null,
            status: 'ONGOING'
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

    socket.on('rejectRide', (data) => {
      console.log(`Driver ${data.driverId} rejected ride ${data.rideId}`);
      // For now, just log. Later we can implement trying next driver
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
        // Broadcast to all in the chat room except sender
        socket.to(`chat_${data.bookingId}`).emit('newMessage', {
          message: data.message,
          sender: data.sender,
          timestamp: new Date().toISOString()
        });
        console.log(`Message sent in chat ${data.bookingId} by ${data.sender}`);
      }
    });

    socket.on('disconnect', () => {
      // Remove from connected drivers
      for (const [driverId, driverData] of connectedDrivers.entries()) {
        if (driverData.socketId === socket.id) {
          connectedDrivers.delete(driverId);
          console.log(`Driver ${driverId} disconnected`);

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

  // Function to select best drivers using advanced scoring algorithm
  const selectBestDrivers = async (ride, availableDrivers) => {
    const rideLocation = { lat: ride.startLatLon.lat, lng: ride.startLatLon.lon };

    // Get driver details from database
    const driverIds = availableDrivers.map(d => d.driverId);
    const drivers = await prisma.comDriver.findMany({
      where: { id: { in: driverIds } },
      select: {
        id: true,
        car: true,
        rating: true,
        createdAt: true,
        comId: true
      }
    });

    // Get company commission rates
    const companyIds = [...new Set(drivers.map(d => d.comId))];
    const companies = await prisma.PartnerCompany.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, commissionRate: true }
    });
    const companyMap = new Map(companies.map(c => [c.id, c.commissionRate]));

    // Calculate target income
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = now.getHours();
    const isDayTime = hour >= 6 && hour < 18;
    let targetIncome, margin;
    if (isWeekend) {
      targetIncome = 600;
      margin = 100;
    } else {
      if (isDayTime) {
        targetIncome = 400;
        margin = 25;
      } else {
        targetIncome = 550;
        margin = 25;
      }
    }

    // Get daily incomes
    const carPlates = drivers.map(d => d.car).filter(car => car);
    const incomes = await prisma.Ride.groupBy({
      by: ['car'],
      where: {
        car: { in: carPlates },
        status: 'COMPLETED',
        createdAt: { gte: new Date(today + 'T00:00:00.000Z'), lt: new Date(today + 'T23:59:59.999Z') }
      },
      _sum: { price: true }
    });
    const incomeMap = new Map(incomes.map(i => [i.car, i._sum.price || 0]));

    // Calculate rough distances
    const roughDistances = availableDrivers.map(driver => ({
      driver,
      distance: calculateDistance(rideLocation, driver.location)
    }));

    console.log('Rough distances:', roughDistances.map(d => ({ driverId: d.driver.driverId, distance: d.distance })));

    // Select candidates within 20km
    const candidates = roughDistances
      .filter(item => item.distance <= 20)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    console.log('Candidates within 20km:', candidates.length);

    // Get precise distances using Google
    const candidateDestinations = candidates.map(item => ({
      lat: item.driver.location.lat,
      lng: item.driver.location.lng
    }));

    let googleResults = [];
    try {
      const { getDistanceAndDuration } = require('./lib/distance');
      googleResults = await getDistanceAndDuration(
        [rideLocation],
        candidateDestinations
      );
    } catch (error) {
      console.warn('Failed to get Google distances:', error);
      googleResults = candidateDestinations.map(() => null);
    }

    // Calculate scores
    const driverScores = candidates.map((candidate, index) => {
      const driver = drivers.find(d => d.id === candidate.driver.driverId);
      if (!driver) return null;

      const commissionRate = companyMap.get(driver.comId) || 0;
      const income = incomeMap.get(driver.car) || 0;

      let distance = candidate.distance;
      let etaMinutes = Math.ceil((distance / 30) * 60);

      if (googleResults[index]) {
        distance = googleResults[index].distance;
        etaMinutes = Math.ceil(googleResults[index].duration);
        console.log(`Driver ${candidate.driver.driverId}: Google distance ${distance}km, ETA ${etaMinutes}min`);
      } else {
        console.log(`Driver ${candidate.driver.driverId}: Rough distance ${distance}km, ETA ${etaMinutes}min`);
      }

      // Scoring system
      let score = 0;

      // Distance score
      if (distance <= 2) score += 10;
      else if (distance <= 5) score += 7;
      else if (distance <= 10) score += 4;
      else if (distance <= 15) score += 2;

      // Income score
      let incomeScore = 0;
      if (income < targetIncome - margin) incomeScore = 20;
      else if (income < targetIncome + margin) incomeScore = 10;
      score += incomeScore;

      // Experience score
      const yearsExperience = (Date.now() - new Date(driver.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsExperience >= 2) score += 15;
      else if (yearsExperience >= 1) score += 10;
      else score += 5;

      // Commission score
      if (commissionRate >= 12) score += 10;
      else if (commissionRate >= 8) score += 5;

      return {
        driver: candidate.driver,
        distance: Math.round(distance * 10) / 10,
        etaMinutes,
        score,
        rating: driver.rating,
        commissionRate,
        experience: yearsExperience >= 2 ? 'high' : yearsExperience >= 1 ? 'medium' : 'low',
        income
      };
    }).filter(item => item !== null);

    // Select best drivers
    const vehiclesWithin15km = driverScores.filter(d => d.distance <= 15);
    let topDrivers;

    if (vehiclesWithin15km.length > 0) {
      topDrivers = vehiclesWithin15km
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    } else {
      topDrivers = driverScores
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);
    }

    return topDrivers;
  };

  // Function to check for new rides and assign to drivers
  const checkForNewRides = async () => {
    try {
      // Get new confirmed rides without driver
      const newRides = await prisma.ride.findMany({
        where: {
          status: 'CONFIRMED',
          paymentMethod: { not: null },
          driverId: null,
          car: null
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            }
          },
          vehicleType: {
            select: {
              id: true,
              title: true,
              capacity: true
            }
          }
        },
        orderBy: {
          pickupTime: 'asc'
        }
      });

      for (const ride of newRides) {
        console.log(`Checking ride ${ride.id} with vehicleTypeId ${ride.vehicleTypeId}, pickup: ${ride.pickupLat}, ${ride.pickupLng}`);
        console.log(`Connected drivers count: ${connectedDrivers.size}`);

        // Find available drivers for this vehicle type
        let availableDrivers = Array.from(connectedDrivers.entries())
          .filter(([driverId, driverData]) => {
            const matchesType = driverData.vehicleTypeId === ride.vehicleTypeId;
            const hasLocation = !!driverData.location;
            console.log(`Driver ${driverId}: type ${driverData.vehicleTypeId} (${matchesType ? 'match' : 'no match'}), location: ${hasLocation ? 'yes' : 'no'}`);
            return matchesType && hasLocation;
          })
          .map(([driverId, driverData]) => ({
            driverId: parseInt(driverId),
            location: driverData.location,
            socketId: driverData.socketId
          }));

        // If no drivers with socket location, try to get from database
        if (availableDrivers.length === 0) {
          const connectedDriverIds = Array.from(connectedDrivers.keys()).map(id => parseInt(id));
          const driversWithDbLocation = await prisma.comDriver.findMany({
            where: {
              id: { in: connectedDriverIds },
              isOnline: true,
              isActive: true,
              car: { not: null }
            },
            select: {
              id: true,
              car: true
            }
          });

          const carPlates = driversWithDbLocation.map(d => d.car).filter(car => car !== null);
          const vehiclesWithLocation = await prisma.comVehicles.findMany({
            where: {
              regNumber: { in: carPlates },
              lastLat: { not: null },
              lastLon: { not: null }
            },
            select: {
              id: true,
              regNumber: true,
              lastLat: true,
              lastLon: true
            }
          });

          availableDrivers = vehiclesWithLocation.map(vehicle => {
            const driver = driversWithDbLocation.find(d => d.car === vehicle.regNumber);
            if (driver && connectedDrivers.has(driver.id.toString())) {
              const driverData = connectedDrivers.get(driver.id.toString());
              if (driverData.vehicleTypeId === ride.vehicleTypeId) {
                return {
                  driverId: driver.id,
                  location: { lat: vehicle.lastLat, lng: vehicle.lastLon },
                  socketId: driverData.socketId
                };
              }
            }
            return null;
          }).filter(d => d !== null);
        }

        if (availableDrivers.length === 0) {
          console.log(`No available drivers for ride ${ride.id}`);
          continue;
        }

        // Use advanced selection algorithm
        const selectedDrivers = await selectBestDrivers(ride, availableDrivers);

        if (selectedDrivers.length === 0) {
          console.log(`No suitable drivers found for ride ${ride.id}`);
          continue;
        }

        // Try to assign to selected drivers in order
        let assigned = false;
        for (const driverScore of selectedDrivers) {
          if (assigned) break;

          // Update driver status - set currentRideId and rideAccepted to 0
          await prisma.comDriver.update({
            where: { id: driverScore.driver.driverId },
            data: {
              currentRideId: ride.id,
              rideAccepted: 0, // 0 means offered, not accepted yet
              // Keep isBusy as false until ride is accepted
            }
          });

          global.io.to(driverScore.driver.socketId).emit('rideOffer', {
            rideId: ride.id,
            timestamp: Date.now()
          });

          console.log(`Sent ride ${ride.id} to driver ${driverScore.driver.driverId} (score: ${driverScore.score}, distance: ${driverScore.distance}km)`);

          // Wait for acceptance
          await new Promise(resolve => {
            const timeout = setTimeout(async () => {
              const currentRide = await prisma.ride.findUnique({
                where: { id: ride.id },
                select: { driverId: true }
              });
              if (currentRide.driverId) {
                assigned = true;
                console.log(`Ride ${ride.id} accepted by driver ${driverScore.driver.driverId}`);
              } else {
                console.log(`Ride ${ride.id} not accepted by driver ${driverScore.driver.driverId}`);
              }
              resolve(null);
            }, 30000);

            // Listen for rejection (simplified)
            // In production, proper event handling would be needed
          });
        }

        if (!assigned) {
          console.log(`No driver accepted ride ${ride.id}`);
        }
      }
    } catch (error) {
      console.error('Error checking for new rides:', error);
    }
  };

  // Helper function to calculate distance
  function calculateDistance(loc1, loc2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(loc2.lat - loc1.lat);
    const dLon = deg2rad(loc2.lng - loc1.lng);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(loc1.lat)) * Math.cos(deg2rad(loc2.lat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  }

  function deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // Check for new rides every 10 seconds
  setInterval(checkForNewRides, 10000);

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});