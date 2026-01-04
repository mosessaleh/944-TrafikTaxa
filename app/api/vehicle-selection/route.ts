import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computePrice } from '@/lib/price';
import { calculateDistance, getDistanceAndDuration } from '@/lib/distance';

interface VehicleSelectionRequest {
  pickupLat: number;
  pickupLon: number;
  vehicleTypeId: number;
  maxVehicles?: number;
  dropoffLat?: number;
  dropoffLon?: number;
  excludedDriverIds?: number[];
}

interface DriverInfo {
  rating: number;
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

export async function POST(request: NextRequest) {
  try {
    const body: VehicleSelectionRequest = await request.json();
    const { pickupLat, pickupLon, vehicleTypeId, maxVehicles = 3, dropoffLat, dropoffLon, excludedDriverIds = [] } = body;

    // console.log('=== VEHICLE SELECTION API START ===');
    // console.log('Input:', { pickupLat, pickupLon, vehicleTypeId, maxVehicles, dropoffLat, dropoffLon });

    if (!pickupLat || !pickupLon || !vehicleTypeId) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required parameters: pickupLat, pickupLon, vehicleTypeId'
      }, { status: 400 });
    }

    // Get available drivers from connected drivers (real-time socket data)
    const connectedDrivers = (global as any).connectedDrivers || new Map();

    // New strategy based on vehicle type
    let searchTypes: number[] = [];
    let maxDistanceMinutes = 10; // Default 10 minutes

    if (vehicleTypeId === 1) { // SEDAN5
      searchTypes = [1]; // First try SEDAN5
    } else if (vehicleTypeId === 2) { // SEVEN_NO_BAG
      searchTypes = [2]; // First try SEVEN_NO_BAG
    } else if (vehicleTypeId === 3) { // VAN
      searchTypes = [3]; // Only VAN
    } else if (vehicleTypeId === 4) { // LIMO
      searchTypes = [4]; // Only LIMO
    }

    let availableDrivers: any[] = [];
    let foundWithin10 = false;

    // First, try to find within 10 minutes
    for (const type of searchTypes) {
      availableDrivers = (Array.from(connectedDrivers.entries()) as [string, any][])
        .filter(([driverId, driverData]) =>
          driverData.vehicleTypeId === type &&
          driverData.location &&
          !excludedDriverIds.includes(parseInt(driverId))
        )
        .map(([driverId, driverData]) => ({
          driverId: parseInt(driverId),
          location: driverData.location,
          socketId: driverData.socketId,
          vehicleTypeId: type
        }));

      // Check if any within 10 minutes
      const within10 = availableDrivers.filter(driver => {
        const distance = calculateDistance(pickupLat, pickupLon, driver.location.lat, driver.location.lng);
        const eta = Math.ceil((distance / 30) * 60);
        return eta <= 10;
      });

      if (within10.length > 0) {
        availableDrivers = within10;
        foundWithin10 = true;
        break;
      }
    }

    // If no drivers within 10 minutes for SEDAN5, try alternatives in order
    if (!foundWithin10 && vehicleTypeId === 1) {
      const alternatives = [2, 3, 4]; // SEVEN_NO_BAG, VAN, LIMO
      for (const altType of alternatives) {
        availableDrivers = (Array.from(connectedDrivers.entries()) as [string, any][])
          .filter(([driverId, driverData]) =>
            driverData.vehicleTypeId === altType &&
            driverData.location &&
            !excludedDriverIds.includes(parseInt(driverId))
          )
          .map(([driverId, driverData]) => ({
            driverId: parseInt(driverId),
            location: driverData.location,
            socketId: driverData.socketId,
            vehicleTypeId: altType
          }));

        const within10 = availableDrivers.filter(driver => {
          const distance = calculateDistance(pickupLat, pickupLon, driver.location.lat, driver.location.lng);
          const eta = Math.ceil((distance / 30) * 60);
          return eta <= 10;
        });

        if (within10.length > 0) {
          availableDrivers = within10;
          foundWithin10 = true;
          break;
        }
      }
    }

    // If no drivers within 10 minutes for SEVEN_NO_BAG, try VAN
    if (!foundWithin10 && vehicleTypeId === 2) {
      availableDrivers = (Array.from(connectedDrivers.entries()) as [string, any][])
        .filter(([driverId, driverData]) =>
          driverData.vehicleTypeId === 3 && // VAN
          driverData.location &&
          !excludedDriverIds.includes(parseInt(driverId))
        )
        .map(([driverId, driverData]) => ({
          driverId: parseInt(driverId),
          location: driverData.location,
          socketId: driverData.socketId,
          vehicleTypeId: 3
        }));

      const within10 = availableDrivers.filter(driver => {
        const distance = calculateDistance(pickupLat, pickupLon, driver.location.lat, driver.location.lng);
        const eta = Math.ceil((distance / 30) * 60);
        return eta <= 10;
      });

      if (within10.length > 0) {
        availableDrivers = within10;
        foundWithin10 = true;
      }
    }

    // If still no drivers within 10 minutes, expand to 11-20 minutes and allow any type
    if (!foundWithin10) {
      maxDistanceMinutes = 20;
      let allTypes: number[] = [];
      if (vehicleTypeId === 1) {
        allTypes = [1, 2, 3, 4];
      } else if (vehicleTypeId === 2) {
        allTypes = [2, 3];
      } else {
        allTypes = [vehicleTypeId];
      }

      availableDrivers = (Array.from(connectedDrivers.entries()) as [string, any][])
        .filter(([driverId, driverData]) =>
          allTypes.includes(driverData.vehicleTypeId) &&
          driverData.location &&
          !excludedDriverIds.includes(parseInt(driverId))
        )
        .map(([driverId, driverData]) => ({
          driverId: parseInt(driverId),
          location: driverData.location,
          socketId: driverData.socketId,
          vehicleTypeId: driverData.vehicleTypeId
        }));

      // Filter to 11-20 minutes
      availableDrivers = availableDrivers.filter(driver => {
        const distance = calculateDistance(pickupLat, pickupLon, driver.location.lat, driver.location.lng);
        const eta = Math.ceil((distance / 30) * 60);
        return eta >= 11 && eta <= 20;
      });
    }

    // Database fallback with same logic
    let useDatabaseFallback = false;
    if (availableDrivers.length === 0) {
      console.log('No connected drivers found, using database fallback for vehicle selection');
      useDatabaseFallback = true;

      // Get online drivers from database
      const onlineDriversFromDb: any[] = await (prisma as any).comDriver.findMany({
        where: {
          isOnline: true,
          isActive: true,
          car: { not: null },
          currentRideId: null, // Driver must not have a current ride
          isBusy: false // Driver must not be busy
        },
        select: {
          id: true,
          car: true
        }
      });

      if (onlineDriversFromDb.length > 0) {
        const carPlates = onlineDriversFromDb.map(d => d.car).filter(car => car !== null);

        // Get vehicles with location data
        const vehiclesWithLocation: any[] = await (prisma as any).comVehicles.findMany({
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

        // Create availableDrivers from database data with same logic
        // For simplicity, apply similar filtering
        availableDrivers = vehiclesWithLocation.map(vehicle => {
          const driver = onlineDriversFromDb.find(d => d.car === vehicle.regNumber);
          if (driver) {
            // Need to get vehicle type from somewhere, assume from vehicle or driver
            // For now, assume we can get it
            return {
              driverId: driver.id,
              location: { lat: vehicle.lastLat, lng: vehicle.lastLon },
              socketId: null,
              vehicleTypeId: vehicleTypeId // Simplified
            };
          }
          return null;
        }).filter(d => d !== null) as any[];
      }
    }

    if (availableDrivers.length === 0) {
      return NextResponse.json({
        ok: true,
        vehicles: [],
        totalAvailable: 0,
        selectedCount: 0,
        strategy: useDatabaseFallback ? 'Database fallback: no online drivers with location' : 'Real-time socket-based selection: no connected drivers'
      });
    }

    // Get driver and vehicle details from database for scoring
    const driverIds = availableDrivers.map(d => d.driverId);
    const onlineDrivers: any[] = await (prisma as any).comDriver.findMany({
      where: {
        id: { in: driverIds },
        isActive: true,
        car: { not: null },
        currentRideId: null, // Driver must not have a current ride
        isBusy: false // Driver must not be busy
      },
      select: {
        id: true,
        car: true,
        rating: true,
        createdAt: true,
        comId: true
      }
    });

    // Filter availableDrivers to only include drivers that are not busy
    const availableDriverIds = onlineDrivers.map(d => d.id);
    availableDrivers = availableDrivers.filter(d => availableDriverIds.includes(d.driverId));

    const carPlates = onlineDrivers.map((d: any) => d.car).filter((car: any): car is string => car !== null);

    // Get vehicles (we still need vehicle IDs for response)
    const vehicles: any[] = await (prisma as any).comVehicles.findMany({
      where: {
        regNumber: { in: carPlates }
      },
      select: {
        id: true,
        regNumber: true,
        comId: true
      }
    });

    // Get company commission rates
    const companyIds = [...new Set(vehicles.map((v: any) => v.comId))];
    const companies: any[] = await (prisma as any).PartnerCompany.findMany({
      where: {
        id: { in: companyIds }
      },
      select: {
        id: true,
        commissionRate: true
      }
    });

    const companyMap = new Map(companies.map((c: any) => [c.id, c.commissionRate]));
    const driverMap = new Map(onlineDrivers.map((d: any) => [d.car, {
      rating: d.rating,
      createdAt: d.createdAt,
      comId: d.comId
    } as DriverInfo]));

    // Calculate target income based on current time
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = now.getHours();
    const isDayTime = hour >= 6 && hour < 18;
    let targetIncome: number;
    let margin: number;
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

    // Get daily incomes for drivers
    const incomes: any[] = await (prisma as any).Ride.groupBy({
      by: ['car'],
      where: {
        car: { in: carPlates },
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(today + 'T00:00:00.000Z'),
          lt: new Date(today + 'T23:59:59.999Z')
        }
      },
      _sum: {
        price: true
      }
    });
    const incomeMap = new Map(incomes.map((i: any) => [i.car, i._sum.price || 0]));

    // Calculate distances using real-time socket locations
    const driverDistances = availableDrivers.map((driver: any) => ({
      driver,
      distance: calculateDistance(pickupLat, pickupLon, driver.location.lat, driver.location.lng)
    }));

    // Sort by distance and select top candidates (e.g., within 20km)
    const candidates = driverDistances
      .filter(item => item.distance <= 20) // Only drivers within 20km
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Math.min(10, availableDrivers.length)); // Take top 10 closest

    // Get precise distances using Google for vehicle selection API
    const candidateDestinations = candidates.map(item => ({
      lat: item.driver.location.lat,
      lng: item.driver.location.lng
    }));

    let googleResults = [];
    try {
      const { getDistanceAndDuration } = require('@/lib/distance');
      googleResults = await getDistanceAndDuration(
        [{ lat: pickupLat, lng: pickupLon }],
        candidateDestinations
      );
    } catch (error) {
      console.warn('Failed to get Google distances for vehicle selection:', error);
      googleResults = candidateDestinations.map(() => null);
    }

    const candidateResults = candidates.map((candidate, index) => {
      let distance = candidate.distance;
      let etaMinutes = Math.ceil((candidate.distance / 30) * 60);

      if (googleResults[index]) {
        distance = googleResults[index].distance;
        etaMinutes = Math.ceil(googleResults[index].duration);
      }

      return {
        driver: candidate.driver,
        distance,
        etaMinutes
      };
    });

    // Calculate scores for each candidate driver using the agreed strategy
    const vehicleScores: VehicleScore[] = candidateResults.map((item) => {
      // Find the vehicle for this driver
      const driverInfo = onlineDrivers.find(d => d.id === item.driver.driverId);
      if (!driverInfo) return null;

      const vehicle = vehicles.find(v => v.regNumber === driverInfo.car);
      if (!vehicle) return null;

      const driver = driverMap.get(vehicle.regNumber) as DriverInfo | undefined;
      if (!driver) return null;

      const commissionRate = companyMap.get(vehicle.comId) || 0;
      const income = incomeMap.get(vehicle.regNumber) || 0;

      // Use real-time distance
      let distance = item.distance;
      let etaMinutes = item.etaMinutes;

      // Priority scoring system (distance, type, income, rating)
      let score = 0;

      // Distance score (closer = higher score, but balanced)
      if (distance <= 2) score += 10;      // Within 2km: +10
      else if (distance <= 5) score += 7; // Within 5km: +7
      else if (distance <= 10) score += 4; // Within 10km: +4
      else if (distance <= 15) score += 2;  // Within 15km: +2

      // Income score (prefer lower income to balance daily earnings)
      let incomeScore = 0;
      if (income < targetIncome - margin) {
        incomeScore = 20; // Well below target, high preference
      } else if (income < targetIncome + margin) {
        incomeScore = 10; // Around target, medium preference
      } else {
        incomeScore = 0; // Above target, low preference
      }
      score += incomeScore;

      // Rating score (higher rating = higher score) - TEMPORARILY DISABLED
      // score += (driver.rating - 3) * 10; // Rating 5.0 = +20, Rating 3.0 = 0

      // Experience score (derived from driver creation date)
      const yearsExperience = (Date.now() - new Date(driver.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
      let experience: 'low' | 'medium' | 'high';
      if (yearsExperience >= 2) experience = 'high';
      else if (yearsExperience >= 1) experience = 'medium';
      else experience = 'low';

      if (experience === 'high') score += 15;
      else if (experience === 'medium') score += 10;
      else score += 5;

      // Company commission rate (higher commission = higher score - more profit)
      if (commissionRate >= 12) score += 10;
      else if (commissionRate >= 8) score += 5;

      return {
        vehicleId: vehicle.id,
        distance: Math.round(distance * 10) / 10,
        etaMinutes,
        score,
        rating: driver.rating,
        commissionRate,
        experience,
        income
      };
    }).filter((item): item is VehicleScore => item !== null);

    // Check if any vehicles are within 15km (15 minutes)
    const vehiclesWithin15km = vehicleScores.filter(v => v.distance <= 15);

    // Store whether we used scoring algorithm for response
    const usedScoringAlgorithm = vehiclesWithin15km.length > 0;

    let topVehicles: VehicleScore[];

    if (vehiclesWithin15km.length > 0) {
      // If there are vehicles within 15km, use the scoring algorithm
      topVehicles = vehiclesWithin15km
        .sort((a, b) => b.score - a.score) // Sort by score descending
        .slice(0, Math.min(maxVehicles, vehiclesWithin15km.length));

      // If still need more vehicles, add closest vehicles within 30km
      if (topVehicles.length < maxVehicles) {
        const remaining = vehicleScores
          .filter(v => v.distance > 15 && v.distance <= 30 && !topVehicles.some(tv => tv.vehicleId === v.vehicleId))
          .sort((a, b) => a.distance - b.distance); // Sort by distance ascending
        const additional = remaining.slice(0, maxVehicles - topVehicles.length);
        topVehicles = topVehicles.concat(additional);
      }
    } else {
      // If no vehicles within 15km, just select the closest vehicles (no scoring algorithm)
      topVehicles = vehicleScores
        .sort((a, b) => a.distance - b.distance) // Sort by distance ascending only
        .slice(0, Math.min(maxVehicles, vehicleScores.length));
    }

    // Create map from vehicleId to driverId
    const vehicleToDriverMap = new Map();
    onlineDrivers.forEach((driver: any) => {
      const vehicle = vehicles.find((v: any) => v.regNumber === driver.car);
      if (vehicle) {
        vehicleToDriverMap.set(vehicle.id, driver.id);
      }
    });

    let finalVehicles = topVehicles.map((item: VehicleScore) => item.vehicleId);
    let longWait = false;
    let fallbackVehicles: number[] = [];

    // Fallback for distant vehicles if all selected vehicles are too far (>30 min) and dropoff provided
    const allVehiclesTooFar = finalVehicles.length > 0 && vehicleScores.every(v => v.distance > 30); // More than 30 min (30km at 60km/h)
    const shouldTriggerFallback = (finalVehicles.length === 0 || allVehiclesTooFar) && dropoffLat && dropoffLon;

    if ((finalVehicles.length === 0 || allVehiclesTooFar) && dropoffLat && dropoffLon) {
      // Calculate trip distance and time
      const tripDistance = calculateDistance(pickupLat, pickupLon, dropoffLat, dropoffLon);
      const tripTimeHours = tripDistance / 30; // Assume 30 km/h average speed
      const tripTimeMin = tripTimeHours * 60;

      // Estimate price for the trip
      const pickupTime = new Date(); // Use current time for estimation
      const estimatedPrice = await computePrice(tripDistance, tripTimeMin, pickupTime, vehicleTypeId);

      // Check each candidate driver for profitability
      for (const item of candidateResults) {
        const driverInfo = onlineDrivers.find(d => d.id === item.driver.driverId);
        if (!driverInfo) continue;

        const vehicle = vehicles.find(v => v.regNumber === driverInfo.car);
        if (!vehicle) continue;

        const vehicleScore = vehicleScores.find(v => v.vehicleId === vehicle.id);
        if (!vehicleScore) continue;

        const timeToPickupHours = vehicleScore.distance / 30;
        const returnTimeHours = tripDistance / 30;
        const totalTimeHours = timeToPickupHours + tripTimeHours + returnTimeHours;

        if (totalTimeHours > 0) {
          const pricePerHour = estimatedPrice / totalTimeHours;
          if (pricePerHour > 400) { // 400 DKK per hour threshold
            fallbackVehicles.push(vehicleScore.vehicleId);
          }
        }
      }

      // Sort fallback vehicles by distance and select top
      if (fallbackVehicles.length > 0) {
        const fallbackSorted = vehicleScores
          .filter(v => fallbackVehicles.includes(v.vehicleId))
          .sort((a, b) => a.distance - b.distance);
        finalVehicles = fallbackSorted.slice(0, Math.min(maxVehicles, fallbackSorted.length)).map(v => v.vehicleId);
        longWait = true;
      }
    }

    // Determine which strategy was used
    const strategyDescription = usedScoringAlgorithm
      ? 'Advanced scoring: distance + income + experience + commission (vehicles within 15km)'
      : 'Distance-based selection only (no vehicles within 15km)';

    return NextResponse.json({
      ok: true,
      vehicles: finalVehicles,
      totalAvailable: vehicles.length, // Total vehicles available, not just candidates
      selectedCount: finalVehicles.length,
      strategy: strategyDescription,
      usedScoringAlgorithm,
      longWait,
      scores: topVehicles.map((v: VehicleScore) => ({
        id: v.vehicleId,
        score: usedScoringAlgorithm ? v.score : 0, // No score if distance-only
        distance: v.distance,
        etaMinutes: v.etaMinutes,
        rating: v.rating,
        experience: v.experience,
        commissionRate: v.commissionRate,
        income: v.income
      }))
    });

  } catch (error) {
    console.error('Error in vehicle selection:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error during vehicle selection'
    }, { status: 500 });
  }
}