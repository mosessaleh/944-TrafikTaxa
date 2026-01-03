import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateDistance } from '@/lib/distance';
import { getSocketServer } from '@/lib/socket-server';

interface DriverInfo {
  rating: any; // Prisma Decimal
  createdAt: Date;
  comId: number;
}

interface VehicleScore {
  vehicleId: number;
  distance: number;
  etaMinutes: number;
  score: number;
  rating: number;
  commissionRate: number;
  experience: 'low' | 'medium' | 'high';
  income: number;
}

// Function to select best drivers using advanced scoring algorithm
const selectBestDrivers = async (ride: any, availableDrivers: any[]) => {
  const rideLocation = { lat: ride.startLatLon?.lat || ride.pickupLat, lng: ride.startLatLon?.lon || ride.pickupLon };

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
  const companies = await (prisma as any).PartnerCompany.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, commissionRate: true }
  });
  const companyMap = new Map(companies.map((c: any) => [c.id, c.commissionRate]));

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
  const incomes = await (prisma as any).Ride.groupBy({
    by: ['car'],
    where: {
      car: { in: carPlates },
      status: 'COMPLETED',
      createdAt: { gte: new Date(today + 'T00:00:00.000Z'), lt: new Date(today + 'T23:59:59.999Z') }
    },
    _sum: { price: true }
  });
  const incomeMap = new Map(incomes.map((i: any) => [i.car, i._sum.price || 0]));

  // Calculate rough distances
  const roughDistances = availableDrivers.map(driver => ({
    driver,
    distance: calculateDistance(rideLocation.lat, rideLocation.lng, driver.location.lat, driver.location.lng)
  }));

  // Select candidates within 20km
  const candidates = roughDistances
    .filter(item => item.distance <= 20)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  // Calculate scores
  const driverScores: VehicleScore[] = candidates.map((candidate) => {
    const driver = drivers.find(d => d.id === candidate.driver.driverId);
    if (!driver) return null;

    const vehicle = { id: driver.id, regNumber: driver.car, comId: driver.comId }; // Simplified vehicle object
    const driverInfo = {
      rating: driver.rating,
      createdAt: driver.createdAt,
      comId: driver.comId
    } as DriverInfo;

    const commissionRate = Number(companyMap.get(vehicle.comId) || 0);
    const income = Number(incomeMap.get(vehicle.regNumber) || 0);

    let distance = candidate.distance;
    let etaMinutes = Math.ceil((distance / 30) * 60);

    // Scoring system - prioritize distance first
    let score = 0;

    // Distance score (highest priority)
    if (distance <= 2) score += 50;
    else if (distance <= 5) score += 35;
    else if (distance <= 10) score += 20;
    else if (distance <= 15) score += 10;
    else if (distance <= 20) score += 5;

    // Income score (secondary priority)
    let incomeScore = 0;
    if (income < targetIncome - margin) incomeScore = 15;
    else if (income < targetIncome + margin) incomeScore = 8;
    score += incomeScore;

    // Experience score (tertiary priority)
    const yearsExperience = (Date.now() - new Date(driverInfo.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (yearsExperience >= 2) score += 10;
    else if (yearsExperience >= 1) score += 5;
    else score += 2;

    // Commission score (lowest priority)
    if (commissionRate >= 12) score += 5;
    else if (commissionRate >= 8) score += 2;

    return {
      vehicleId: vehicle.id,
      distance: Math.round(distance * 10) / 10,
      etaMinutes,
      score,
      rating: driverInfo.rating,
      commissionRate,
      experience: yearsExperience >= 2 ? 'high' : yearsExperience >= 1 ? 'medium' : 'low',
      income
    };
  }).filter(item => item !== null) as VehicleScore[];

  // Select best drivers
  const vehiclesWithin15km = driverScores.filter(v => v.distance <= 15);
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

export async function POST(request: NextRequest) {
  try {
    // Get all confirmed rides without driver (limit to 10 at a time to avoid overload)
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
      },
      take: 10 // Process only 10 rides at a time
    });

    console.log(`Found ${newRides.length} confirmed rides without drivers`);

    for (const ride of newRides) {
      // Get online drivers from database
      const onlineDriversFromDb: any[] = await prisma.comDriver.findMany({
        where: {
          isOnline: true,
          isActive: true,
          car: { not: null }
        },
        select: {
          id: true,
          car: true
        }
      });

      if (onlineDriversFromDb.length === 0) {
        console.log(`No online drivers available for ride ${ride.id}`);
        continue;
      }

      // Get vehicles with location data
      const carPlates = onlineDriversFromDb.map(d => d.car).filter(car => car !== null);
      const vehiclesWithLocation: any[] = await prisma.comVehicles.findMany({
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

      // Create availableDrivers from database data
      const availableDrivers = vehiclesWithLocation.map(vehicle => {
        const driver = onlineDriversFromDb.find(d => d.car === vehicle.regNumber);
        if (driver) {
          return {
            driverId: driver.id,
            location: { lat: vehicle.lastLat, lng: vehicle.lastLon },
          };
        }
        return null;
      }).filter(d => d !== null) as any[];

      if (availableDrivers.length === 0) {
        console.log(`No drivers with location data available for ride ${ride.id}`);
        continue;
      }

      // Use vehicle-selection API for advanced selection
      console.log(`[ASSIGN] Calling vehicle-selection API for ride ${ride.id}`);
      const startLatLon = ride.startLatLon as any;
      const endLatLon = ride.endLatLon as any;
      const selectionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vehicle-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupLat: startLatLon?.lat,
          pickupLon: startLatLon?.lon,
          dropoffLat: endLatLon?.lat,
          dropoffLon: endLatLon?.lon,
          vehicleTypeId: ride.vehicleTypeId,
          maxVehicles: 3
        })
      });

      let selectedVehicles = [];
      if (selectionResponse.ok) {
        const selectionData = await selectionResponse.json();
        if (selectionData.ok && selectionData.vehicles?.length > 0) {
          selectedVehicles = selectionData.vehicles;
          console.log(`[ASSIGN] Vehicle selection API returned ${selectedVehicles.length} vehicles for ride ${ride.id}`);
        } else {
          console.log(`[ASSIGN] Vehicle selection API returned no vehicles for ride ${ride.id}`);
          continue;
        }
      } else {
        console.error(`[ASSIGN] Failed to call vehicle-selection API for ride ${ride.id}`);
        continue;
      }

      // Get drivers for selected vehicles
      const vehicleDrivers = await prisma.comDriver.findMany({
        where: {
          car: { in: vehiclesWithLocation.filter(v => selectedVehicles.includes(v.id)).map(v => v.regNumber) }
        },
        select: { id: true, car: true }
      });

      // Create map from vehicleId to driverId
      const vehicleToDriverMap = new Map();
      vehicleDrivers.forEach(driver => {
        const vehicle = vehiclesWithLocation.find(v => v.regNumber === driver.car);
        if (vehicle) {
          vehicleToDriverMap.set(vehicle.id, driver.id);
        }
      });

      // Send ride offer to all selected drivers simultaneously
      const offeredDrivers = [];
      for (const vehicleId of selectedVehicles) {
        const driverId = vehicleToDriverMap.get(vehicleId);
        if (!driverId) {
          console.log(`[ASSIGN] No driver found for vehicle ${vehicleId}, skipping`);
          continue;
        }

        // Check if driver is still available (not busy and no current ride at all)
        const driver = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: { isBusy: true, currentRideId: true, rideAccepted: true }
        });

        if (driver?.isBusy || driver?.currentRideId) {
          console.log(`[ASSIGN] Driver ${driverId} is busy or has current ride, skipping`);
          continue;
        }

        // Update driver status - set currentRideId and rideAccepted to 0 (offered)
        await prisma.comDriver.update({
          where: { id: driverId },
          data: {
            currentRideId: ride.id,
            rideAccepted: 0, // 0 means offered, not accepted yet
            // Keep isBusy as false until ride is accepted
          }
        });

        offeredDrivers.push(driverId);

        // Send WebSocket notification to driver
        const io = getSocketServer();
        if (io) {
          io.to(`driver_${driverId}`).emit('rideOffer', {
            action: 'offer',
            rideId: ride.id,
            timestamp: Date.now()
          });
          console.log(`[ASSIGN] WebSocket rideOffer sent to driver ${driverId} for ride ${ride.id}`);
        } else {
          console.warn(`[ASSIGN] WebSocket io not available, driver ${driverId} will not receive ride offer notification`);
        }

        console.log(`[ASSIGN] Ride ${ride.id} offered to driver ${driverId} via vehicle ${vehicleId}`);
      }

      const assigned = offeredDrivers.length > 0;

      if (!assigned) {
        console.log(`No driver accepted ride ${ride.id}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Processed ${newRides.length} rides`,
      assigned: newRides.length
    });

  } catch (error) {
    console.error('Error in ride assignment:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error during ride assignment'
    }, { status: 500 });
  }
}