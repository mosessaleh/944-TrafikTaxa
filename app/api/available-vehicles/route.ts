import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateDistance, getDistanceAndDuration } from '@/lib/distance';
import { computePrice } from '@/lib/price';

interface VehicleWithStatus {
  id: number;
  regNumber: string;
  lastLat: number | null;
  lastLon: number | null;
  lastLocationUpdate: Date | null;
  vehicleType: string | null;
  make: string;
  model: string;
  status: number;
  isBusy: boolean;
  estimatedExtraTime: number;
  etaMinutes: number | null;
  distance?: number;
}

interface OnlineDriver {
  id: number;
  car: string;
  currentRideId: number | null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pickupLat = searchParams.get('pickupLat');
    const pickupLon = searchParams.get('pickupLon');
    const vehicleTypeId = searchParams.get('vehicleTypeId');
    const dropoffLat = searchParams.get('dropoffLat');
    const dropoffLon = searchParams.get('dropoffLon');

    console.log('Available-vehicles: Request params:', { pickupLat, pickupLon, vehicleTypeId, dropoffLat, dropoffLon });

    // For testing - return empty array if no params
    if (!pickupLat && !pickupLon && !vehicleTypeId) {
      console.log('Available-vehicles: No params provided, returning empty for testing');
      return NextResponse.json({
        ok: true,
        vehicles: [],
        strategyUsed: false
      });
    }

    // If strategy parameters are provided, use the vehicle selection strategy
    if (pickupLat && pickupLon && vehicleTypeId) {
      console.log('Available-vehicles: Using strategy with params:', { pickupLat, pickupLon, vehicleTypeId });
      console.log('Available-vehicles: Using strategy with params:', { pickupLat, pickupLon, vehicleTypeId });
      try {
      const strategyResponse = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vehicle-selection`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-api-key': process.env.INTERNAL_API_KEY || ''
            },
            body: JSON.stringify({
              pickupLat: parseFloat(pickupLat),
              pickupLon: parseFloat(pickupLon),
              vehicleTypeId: parseInt(vehicleTypeId),
              maxVehicles: 3 // Same as booking to ensure consistency
            })
          }
        );

        console.log('Available-vehicles: Strategy response status:', strategyResponse.status);
        if (strategyResponse.status === 403) {
          return NextResponse.json({
            ok: false,
            error: 'Vehicle selection strategy unavailable (internal authorization failed)'
          }, { status: 500 });
        }
        if (strategyResponse.ok) {
          const strategyData = await strategyResponse.json();
          console.log('Available-vehicles: Strategy data:', { ok: strategyData.ok, vehiclesCount: strategyData.vehicles?.length });
          if (strategyData.ok && strategyData.vehicles?.length > 0) {
            // Get full vehicle details for the selected vehicles
            const vehicles = await (prisma as any).comVehicles.findMany({
              where: {
                id: { in: strategyData.vehicles },
                lastLat: { not: null },
                lastLon: { not: null }
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

            // Add driver information and busy status
            const vehiclesWithStatus = await Promise.all(vehicles.map(async (vehicle: any) => {
              const driver = await prisma.comDriver.findFirst({
                where: { car: vehicle.regNumber },
                select: { currentRideId: true }
              });

              // Calculate ETA from pickup location using Google Maps API
              let etaMinutes = 0;
              if (vehicle.lastLat && vehicle.lastLon && pickupLat && pickupLon) {
                const distanceResults = await getDistanceAndDuration(
                  [{ lat: vehicle.lastLat, lng: vehicle.lastLon }],
                  [{ lat: parseFloat(pickupLat), lng: parseFloat(pickupLon) }]
                );
                const distanceData = distanceResults[0];
                if (distanceData) {
                  etaMinutes = Math.ceil(distanceData.duration);
                } else {
                  // Fallback to simple calculation
                  const distance = calculateDistance(
                    vehicle.lastLat,
                    vehicle.lastLon,
                    parseFloat(pickupLat),
                    parseFloat(pickupLon)
                  );
                  const averageSpeedKmh = 30;
                  etaMinutes = Math.ceil((distance / averageSpeedKmh) * 60);
                }
              }

              return {
                ...vehicle,
                isBusy: driver ? driver.currentRideId !== null : false,
                estimatedExtraTime: 0, // Strategy already accounts for this
                etaMinutes
              };
            }));

            // Return vehicles in the order provided by the strategy (don't re-sort by distance)
            // The vehicle-selection API already provides the optimal order
            return NextResponse.json({
              ok: true,
              vehicles: vehiclesWithStatus,
              strategyUsed: true
            });
          } else {
            console.log('Available-vehicles: Strategy data not ok or no vehicles');
          }
        }
      } catch (strategyError) {
        console.error('Strategy API failed, cannot provide vehicles without strategy:', strategyError);
        return NextResponse.json({
          ok: false,
          error: 'Vehicle selection strategy unavailable'
        }, { status: 500 });
      }
    } else {
      // No strategy parameters provided - return all online vehicles for map display
      console.log('Available-vehicles: No strategy params, returning all online vehicles for map display');
  
      // Debug: Check online drivers
      console.log('Available-vehicles: Checking online drivers...');
    }

    // Fallback/Map display: Get all online drivers with their car assignments
    console.log('Available-vehicles: Starting fallback query for online drivers');
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
    }) as OnlineDriver[];
    console.log('Available-vehicles: Found online drivers:', onlineDrivers.length);
    console.log('Available-vehicles: Sample drivers:', onlineDrivers.slice(0, 3));

    if (onlineDrivers.length === 0) {
      console.log('No online drivers found, returning mock vehicles for testing');
      // Return mock vehicles for testing when no real vehicles exist
      const mockVehicles = [
        {
          id: 1,
          regNumber: 'TEST-001',
          lastLat: 55.6761,
          lastLon: 12.5683,
          lastLocationUpdate: new Date(),
          vehicleType: 'SEDAN5',
          make: 'Test',
          model: 'Car',
          status: 1,
          isBusy: false,
          estimatedExtraTime: 0,
          etaMinutes: 5
        },
        {
          id: 2,
          regNumber: 'TEST-002',
          lastLat: 55.6861,
          lastLon: 12.5783,
          lastLocationUpdate: new Date(),
          vehicleType: 'VAN',
          make: 'Test',
          model: 'Van',
          status: 1,
          isBusy: true,
          estimatedExtraTime: 15,
          etaMinutes: 20
        }
      ];
      return NextResponse.json({
        ok: true,
        vehicles: mockVehicles,
        strategyUsed: false,
        mockData: true
      });
    }

    const carPlates = onlineDrivers.map((d: OnlineDriver) => d.car).filter((car): car is string => car !== null);
    console.log('Available-vehicles: Car plates:', carPlates.slice(0, 5));

    // Get vehicles with location data
    let vehicles: any[];
    try {
      vehicles = await prisma.comVehicles.findMany({
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
          lastLocationUpdate: true,
          vehicleType: true,
          make: true,
          model: true,
          status: true
        }
      });
      console.log('Available-vehicles: Found vehicles:', vehicles.length);
      console.log('Available-vehicles: Sample vehicles:', vehicles.slice(0, 3));
    } catch (vehicleError) {
      console.error('Error fetching vehicles:', vehicleError);
      return NextResponse.json({ ok: true, vehicles: [] });
    }

    // Add busy status and basic ETA calculation
    const vehiclesWithStatus: VehicleWithStatus[] = vehicles.map((vehicle: any) => {
      const driver = onlineDrivers.find((d: OnlineDriver) => d.car === vehicle.regNumber);
      const isBusy = driver ? driver.currentRideId !== null : false;

      // Calculate basic ETA if pickup location is provided (even without strategy)
      let etaMinutes = 0;
      if (vehicle.lastLat && vehicle.lastLon && pickupLat && pickupLon) {
        const distance = calculateDistance(
          vehicle.lastLat,
          vehicle.lastLon,
          parseFloat(pickupLat),
          parseFloat(pickupLon)
        );
        // Basic calculation for map display
        const averageSpeedKmh = 30;
        etaMinutes = Math.ceil((distance / averageSpeedKmh) * 60);
      }

      return {
        ...vehicle,
        isBusy,
        estimatedExtraTime: 0, // Not calculated without strategy
        etaMinutes
      };
    });

    // Filter out busy vehicles for display
    const availableVehicles = vehiclesWithStatus.filter(v => !v.isBusy);

    return NextResponse.json({
      ok: true,
      vehicles: availableVehicles,
      strategyUsed: false, // Indicate this is not using smart selection
      debug: {
        onlineDriversCount: onlineDrivers.length,
        carPlatesCount: carPlates.length,
        vehiclesCount: vehicles.length,
        availableVehiclesCount: availableVehicles.length
      }
    });
  } catch (e: any) {
    console.error('Failed to fetch available vehicles:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch available vehicles' }, { status: 500 });
  }
}
