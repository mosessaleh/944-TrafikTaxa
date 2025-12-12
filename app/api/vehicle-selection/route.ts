import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computePrice } from '@/lib/price';
import { calculateDistance } from '@/lib/distance';

interface VehicleSelectionRequest {
  pickupLat: number;
  pickupLon: number;
  vehicleTypeId: number;
  maxVehicles?: number;
  dropoffLat?: number;
  dropoffLon?: number;
}

interface DriverInfo {
  rating: number;
  createdAt: Date;
  comId: number;
}

interface VehicleScore {
  vehicleId: number;
  distance: number;
  score: number;
  rating: number;
  commissionRate: number;
  experience: 'low' | 'medium' | 'high';
  income: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: VehicleSelectionRequest = await request.json();
    const { pickupLat, pickupLon, vehicleTypeId, maxVehicles = 3, dropoffLat, dropoffLon } = body;

    // console.log('=== VEHICLE SELECTION API START ===');
    // console.log('Input:', { pickupLat, pickupLon, vehicleTypeId, maxVehicles, dropoffLat, dropoffLon });

    if (!pickupLat || !pickupLon || !vehicleTypeId) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required parameters: pickupLat, pickupLon, vehicleTypeId'
      }, { status: 400 });
    }

    // Query available vehicles from database
    // Get online drivers with assigned cars
    const onlineDrivers: any[] = await (prisma as any).comDriver.findMany({
      where: {
        isOnline: true,
        isActive: true,
        car: { not: null }
      },
      select: {
        id: true,
        car: true,
        rating: true,
        createdAt: true,
        comId: true
      }
    });

    if (onlineDrivers.length === 0) {
      return NextResponse.json({
        ok: true,
        vehicles: [],
        totalAvailable: 0,
        selectedCount: 0,
        strategy: 'Advanced scoring: distance + rating + experience + commission'
      });
    }

    const carPlates = onlineDrivers.map((d: any) => d.car).filter((car: any): car is string => car !== null);

    // Get vehicles with location data
    const vehicles: any[] = await (prisma as any).comVehicles.findMany({
      where: {
        regNumber: { in: carPlates },
        lastLat: { not: null },
        lastLon: { not: null }
      },
      select: {
        id: true,
        regNumber: true,
        lastLat: true,
        lastLon: true,
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

    // Calculate scores for each vehicle using the agreed strategy
    const vehicleScores: VehicleScore[] = vehicles.map((vehicle: any) => {
      const driver = driverMap.get(vehicle.regNumber) as DriverInfo | undefined;
      if (!driver) return null;

      const commissionRate = companyMap.get(vehicle.comId) || 0;
      const income = incomeMap.get(vehicle.regNumber) || 0;

      // Calculate distance using Haversine formula for accuracy
      const R = 6371; // Earth's radius in km
      const dLat = (vehicle.lastLat - pickupLat) * Math.PI / 180;
      const dLon = (vehicle.lastLon - pickupLon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(pickupLat * Math.PI / 180) * Math.cos(vehicle.lastLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // Priority scoring system (distance, type, income, rating)
      let score = 0;

      // Distance score (closer = higher score)
      if (distance <= 2) score += 50;      // Within 2km: +50
      else if (distance <= 5) score += 30; // Within 5km: +30
      else if (distance <= 10) score += 15; // Within 10km: +15
      else if (distance <= 15) score += 5;  // Within 15km: +5

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

      // Rating score (higher rating = higher score)
      score += (driver.rating - 3) * 10; // Rating 5.0 = +20, Rating 3.0 = 0

      // Experience score (derived from driver creation date)
      const yearsExperience = (Date.now() - new Date(driver.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
      let experience: 'low' | 'medium' | 'high';
      if (yearsExperience >= 2) experience = 'high';
      else if (yearsExperience >= 1) experience = 'medium';
      else experience = 'low';

      if (experience === 'high') score += 15;
      else if (experience === 'medium') score += 10;
      else score += 5;

      // Company commission rate (lower commission = higher score)
      if (commissionRate < 8) score += 10;
      else if (commissionRate < 12) score += 5;

      return {
        vehicleId: vehicle.id,
        distance: Math.round(distance * 10) / 10,
        score,
        rating: driver.rating,
        commissionRate,
        experience,
        income
      };
    }).filter((item): item is VehicleScore => item !== null);

    // Sort all vehicles by distance ascending (closest first), then select top vehicles
    const sortedVehicles = vehicleScores.sort((a, b) => a.distance - b.distance);
    let topVehicles = sortedVehicles.slice(0, Math.min(maxVehicles, sortedVehicles.length));

    // If less than maxVehicles, add additional vehicles within 30km (approx 30 min at 60km/h)
    if (topVehicles.length < maxVehicles) {
      const remaining = sortedVehicles.slice(topVehicles.length).filter(v => v.distance <= 30);
      const additional = remaining.slice(0, maxVehicles - topVehicles.length);
      topVehicles = topVehicles.concat(additional);
    }

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

      // Check each vehicle for profitability
      for (const vehicle of vehicleScores) {
        const timeToPickupHours = vehicle.distance / 30;
        const returnTimeHours = tripDistance / 30;
        const totalTimeHours = timeToPickupHours + tripTimeHours + returnTimeHours;

        if (totalTimeHours > 0) {
          const pricePerHour = estimatedPrice / totalTimeHours;
          if (pricePerHour > 400) { // 400 DKK per hour threshold
            fallbackVehicles.push(vehicle.vehicleId);
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

    return NextResponse.json({
      ok: true,
      vehicles: finalVehicles,
      totalAvailable: vehicleScores.length,
      selectedCount: finalVehicles.length,
      strategy: 'Advanced scoring: distance + rating + experience + commission',
      longWait,
      scores: topVehicles.map((v: VehicleScore) => ({
        id: v.vehicleId,
        score: v.score,
        distance: v.distance,
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