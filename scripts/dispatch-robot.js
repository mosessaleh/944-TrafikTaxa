const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const excludedDrivers = new Map();

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function findNearbyDrivers(location, vehicleTypeId) {
  if (!location || !Array.isArray(location) || location.length !== 2) return [];

  const [lat, lon] = location;

  const drivers = await prisma.comDriver.findMany({
    where: {
      isOnline: true,
      isBusy: false,
      // Add location filter later
    },
    include: {
      company: {
        include: {
          vehicles: {
            where: {
              status: 0, // Available
            },
          },
        },
      },
    },
  });

  console.log(`Total online drivers: ${drivers.length}`);

  // Filter by vehicle type and distance
  const filtered = drivers.filter(d => {
    if (excludedDrivers.get(d.id) > Date.now()) return false;

    const vehicle = d.company.vehicles.find(v => v.vehicleType === vehicleTypeId.toString()); // Adjust
    if (!vehicle) {
      console.log(`Driver ${d.id} no vehicle of type ${vehicleTypeId}`);
      return false;
    }

    // Calculate distance
    if (d.lastLocation) {
      const [dLat, dLon] = d.lastLocation;
      const distance = getDistance(lat, lon, dLat, dLon);
      console.log(`Driver ${d.id} distance: ${distance} km`);
      return distance < 10; // 10 km
    }
    console.log(`Driver ${d.id} no location`);
    return false;
  });

  console.log(`Nearby drivers: ${filtered.length}`);
  return filtered;
}

const runRobot = async () => {
  try {
    console.log('Robot checking for pending rides...');
    // Find confirmed rides without driver
    const pendingRides = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED',
        driverId: null,
      },
      include: {
        vehicleType: true,
      },
    });

    console.log(`Found ${pendingRides.length} pending rides`);

    for (const ride of pendingRides) {
      console.log(`Processing ride ${ride.id}, status: ${ride.status}, driverId: ${ride.driverId}, startLatLon: ${ride.startLatLon}`);
      // Find nearby drivers
      const drivers = await findNearbyDrivers(ride.startLatLon, ride.vehicleTypeId);

      console.log(`Found ${drivers.length} nearby drivers for ride ${ride.id}`);

      for (const driver of drivers) {
        console.log(`Sending to driver ${driver.id}`);
        // Set currentRideId and rideAccepted on driver
        await prisma.comDriver.update({
          where: { id: driver.id },
          data: {
            currentRideId: ride.id,
            rideAccepted: 0 // 0 = pending, 1 = accepted
          }
        });
        console.log(`Set currentRideId ${ride.id} on driver ${driver.id}`);

        // Send notification
        if (global.io) {
          global.io.to(`driver_${driver.id}`).emit('newRide', {
            rideId: ride.id,
            price: ride.price,
            pickupAddress: ride.pickupAddress,
            dropoffAddress: ride.dropoffAddress,
            etaMinutes: 5, // Calculate
            riderName: ride.riderName,
            distanceKm: ride.distanceKm,
            durationMin: ride.durationMin,
            vehicleType: ride.vehicleType.key,
            passengers: ride.passengers,
            paymentMethod: ride.paymentMethod,
            scheduled: ride.scheduled,
          });
        }

        // Wait 30 seconds for response
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Check if accepted
        const updatedRide = await prisma.ride.findUnique({
          where: { id: ride.id },
        });

        if (updatedRide.driverId) {
          console.log(`Ride ${ride.id} accepted by ${updatedRide.driverId}`);
          break; // Stop sending to others
        } else {
          // Clear the offer from driver
          await prisma.comDriver.update({
            where: { id: driver.id },
            data: {
              currentRideId: null,
              rideAccepted: null
            }
          });
          console.log(`Cleared offer from driver ${driver.id}`);

          // Exclude driver temporarily
          excludedDrivers.set(driver.id, Date.now() + 2 * 60 * 1000);
          console.log(`Driver ${driver.id} excluded for 2 minutes`);
          // Deduct rating
          await prisma.comDriver.update({
            where: { id: driver.id },
            data: {
              rating: {
                decrement: 0.01,
              },
            },
          });
          console.log(`Deducted 0.01 from driver ${driver.id} rating`);
        }
      }
    }
  } catch (error) {
    console.error('Robot error:', error);
  }
};

// Run every 10 seconds
setInterval(runRobot, 10000);

console.log('Dispatch robot started');