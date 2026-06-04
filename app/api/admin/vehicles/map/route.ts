import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

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
  isBusy: boolean;
}

export async function GET(request: Request) {
  try {
    await requirePermission('drivers.read');

    // Get all vehicles with their location data
    let vehicles: Vehicle[];
    try {
      vehicles = await (prisma as any).comVehicles.findMany({
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
    } catch (error) {
      vehicles = [];
    }

    // Get online drivers to determine connection status
    let onlineDrivers: OnlineDriver[] = [];
    try {
      onlineDrivers = await (prisma as any).comDriver.findMany({
        where: {
          isOnline: true,
          isActive: true,
          car: { not: null }
        },
        select: {
          car: true,
          currentRideId: true,
          isBusy: true
        }
      });
    } catch (error) {
      onlineDrivers = [];
    }

    // Combine vehicle data with connection status
    const vehiclesWithStatus = vehicles.map(vehicle => {
      const driver = onlineDrivers.find(d => d.car === vehicle.regNumber);
      const isOnline = !!driver;
      const isBusy = driver ? driver.isBusy : false;

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
    return NextResponse.json({
      ok: false,
      error: 'Failed to fetch vehicles'
    }, { status: 500 });
  }
}
