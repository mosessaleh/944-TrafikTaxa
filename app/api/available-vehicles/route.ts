import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    // Get all online drivers with their car assignments and current ride status
    const onlineDrivers = await prisma.comDriver.findMany({
      where: {
        isOnline: true,
        isActive: true,
        car: { not: null }
      },
      select: {
        id: true,
        car: true,
        currentRideId: true
      }
    });

    if (onlineDrivers.length === 0) {
      return NextResponse.json({ ok: true, vehicles: [] });
    }

    const carPlates = onlineDrivers.map(d => d.car).filter((car): car is string => car !== null);

    // Get vehicles with recent location updates
    const vehicles = await prisma.comVehicles.findMany({
      where: {
        regNumber: { in: carPlates },
        lastLat: { not: null },
        lastLon: { not: null },
        lastLocationUpdate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        id: true,
        regNumber: true,
        lastLat: true,
        lastLon: true,
        lastLocationUpdate: true,
        vehicleType: true,
        make: true,
        model: true,
        status: true
      }
    });

    // Add busy status and estimated extra time for each vehicle
    const vehiclesWithStatus = vehicles.map(vehicle => {
      const driver = onlineDrivers.find(d => d.car === vehicle.regNumber);
      const isBusy = driver ? driver.currentRideId !== null : false;
      const estimatedExtraTime = isBusy ? 15 : 0; // 15 minutes to finish current ride

      return {
        ...vehicle,
        isBusy,
        estimatedExtraTime
      };
    });

    return NextResponse.json({ ok: true, vehicles: vehiclesWithStatus });
  } catch (e: any) {
    console.error('Failed to fetch available vehicles:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch available vehicles' }, { status: 500 });
  }
}