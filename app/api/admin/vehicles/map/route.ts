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
      console.log('No vehicles table or data, using mock vehicles for admin map');
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
          currentRideId: true
        }
      });
    } catch (error) {
      console.log('No drivers table or data, using empty online drivers list');
      onlineDrivers = [];
    }

    // If no vehicles in database, add mock vehicles for testing
    if (vehicles.length === 0) {
      console.log('Adding mock vehicles for admin map testing');
      vehicles = [
        {
          id: 1,
          regNumber: 'ADMIN-001',
          lastLat: 55.6761,
          lastLon: 12.5683,
          lastLocationUpdate: new Date(),
          vehicleType: 'SEDAN5',
          make: 'Test',
          model: 'Sedan',
          status: '1'
        },
        {
          id: 2,
          regNumber: 'ADMIN-002',
          lastLat: 55.6861,
          lastLon: 12.5783,
          lastLocationUpdate: new Date(),
          vehicleType: 'VAN',
          make: 'Test',
          model: 'Van',
          status: '1'
        },
        {
          id: 3,
          regNumber: 'ADMIN-003',
          lastLat: 55.6661,
          lastLon: 12.5583,
          lastLocationUpdate: new Date(),
          vehicleType: 'LIMO',
          make: 'Test',
          model: 'Limo',
          status: '1'
        }
      ];
    }

    // Combine vehicle data with connection status
    const vehiclesWithStatus = vehicles.map(vehicle => {
      const driver = onlineDrivers.find(d => d.car === vehicle.regNumber);
      const isOnline = !!driver;
      const isBusy = driver ? driver.currentRideId !== null : false;

      // For mock vehicles, make some appear online
      const isMockVehicle = vehicle.regNumber.startsWith('ADMIN-');
      const mockOnline = isMockVehicle ? (vehicle.id % 2 === 1) : false; // Alternate online/offline
      const mockBusy = isMockVehicle ? (vehicle.id === 2) : false; // Make ADMIN-002 busy

      return {
        ...vehicle,
        isOnline: isOnline || mockOnline,
        isBusy: isBusy || mockBusy
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