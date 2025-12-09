import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Vehicle {
  id: number;
  regNumber: string;
  lastLat: number | null;
  lastLon: number | null;
  lastLocationUpdate: Date | null;
  vehicleType: string;
  make: string;
  model: string;
  status: string;
}

interface OnlineDriver {
  car: string | null;
  currentRideId: number | null;
}

export async function GET(request: Request) {
  try {
    // Get all vehicles with their location data
    const vehicles: Vehicle[] = await (prisma as any).comVehicles.findMany({
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

    // Get online drivers to determine connection status
    const onlineDrivers: OnlineDriver[] = await (prisma as any).comDriver.findMany({
      where: {
        isOnline: true,
        isActive: true,
        car: { not: null }
      },
      select: {
        car: true,
        currentRideId: true
      }
    });

    // Combine vehicle data with connection status
    const vehiclesWithStatus = vehicles.map(vehicle => {
      const driver = onlineDrivers.find(d => d.car === vehicle.regNumber);
      const isOnline = !!driver;
      const isBusy = driver ? driver.currentRideId !== null : false;

      return {
        ...vehicle,
        isOnline,
        isBusy
      };
    });

    return NextResponse.json({
      ok: true,
      vehicles: vehiclesWithStatus,
      timestamp: new Date().toISOString(),
      serverTime: Date.now()
    });
  } catch (e: any) {
    console.error('Failed to fetch vehicles for map:', e?.stack || e?.message || e);
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch vehicles'
    }, { status: 500 });
  }
}