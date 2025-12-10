import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface VehicleSelectionRequest {
  pickupLat: number;
  pickupLon: number;
  vehicleTypeId: number;
  maxVehicles?: number;
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
}

export async function POST(request: NextRequest) {
  try {
    const body: VehicleSelectionRequest = await request.json();
    const { pickupLat, pickupLon, vehicleTypeId, maxVehicles = 3 } = body;

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

    // Calculate scores for each vehicle using the agreed strategy
    const vehicleScores: VehicleScore[] = vehicles.map((vehicle: any) => {
      const driver = driverMap.get(vehicle.regNumber) as DriverInfo | undefined;
      if (!driver) return null;

      const commissionRate = companyMap.get(vehicle.comId) || 0;

      // Calculate distance using Haversine formula for accuracy
      const R = 6371; // Earth's radius in km
      const dLat = (vehicle.lastLat - pickupLat) * Math.PI / 180;
      const dLon = (vehicle.lastLon - pickupLon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(pickupLat * Math.PI / 180) * Math.cos(vehicle.lastLat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      // Priority scoring system (as agreed)
      let score = 0;

      // Distance score (closer = higher score)
      if (distance <= 2) score += 50;      // Within 2km: +50
      else if (distance <= 5) score += 30; // Within 5km: +30
      else if (distance <= 10) score += 15; // Within 10km: +15
      else if (distance <= 15) score += 5;  // Within 15km: +5

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
        experience
      };
    }).filter((item): item is VehicleScore => item !== null);

    // Define allowed distance for "nearby" vehicles
    const allowedDistance = 15; // km - matches the distance scoring limit

    // Separate vehicles into close (within allowed distance) and far
    const closeVehicles = vehicleScores.filter(v => v.distance <= allowedDistance).sort((a, b) => b.score - a.score);
    const farVehicles = vehicleScores.filter(v => v.distance > allowedDistance).sort((a, b) => a.distance - b.distance);

    // Select vehicles: prioritize close vehicles, fill with far vehicles if needed to reach minimum 3
    let topVehicles: VehicleScore[] = [];
    const minVehicles = 3;

    if (closeVehicles.length >= minVehicles) {
      // Enough close vehicles, take top minVehicles (or maxVehicles if smaller)
      topVehicles = closeVehicles.slice(0, Math.min(minVehicles, maxVehicles));
    } else {
      // Not enough close vehicles, take all close and add closest far vehicles to reach minVehicles
      topVehicles = closeVehicles.slice(0, closeVehicles.length);
      const needed = minVehicles - topVehicles.length;
      const farToAdd = farVehicles.slice(0, needed);
      topVehicles = topVehicles.concat(farToAdd);
    }

    // Cap at maxVehicles if specified
    if (topVehicles.length > maxVehicles) {
      topVehicles = topVehicles.slice(0, maxVehicles);
    }

    const finalVehicles = topVehicles.map((item: VehicleScore) => item.vehicleId);

    return NextResponse.json({
      ok: true,
      vehicles: finalVehicles,
      totalAvailable: vehicleScores.length,
      selectedCount: finalVehicles.length,
      strategy: 'Advanced scoring: distance + rating + experience + commission',
      scores: topVehicles.map((v: VehicleScore) => ({
        id: v.vehicleId,
        score: v.score,
        distance: v.distance,
        rating: v.rating,
        experience: v.experience,
        commissionRate: v.commissionRate
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