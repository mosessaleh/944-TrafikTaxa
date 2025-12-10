import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateDistance } from '@/lib/distance';

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

    // If strategy parameters are provided, use the vehicle selection strategy
    if (pickupLat && pickupLon && vehicleTypeId) {
      try {
        const strategyResponse = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vehicle-selection`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pickupLat: parseFloat(pickupLat),
              pickupLon: parseFloat(pickupLon),
              vehicleTypeId: parseInt(vehicleTypeId),
              maxVehicles: 10 // Return more vehicles for map display
            })
          }
        );

        if (strategyResponse.ok) {
          const strategyData = await strategyResponse.json();
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
              const driver = await (prisma as any).comDriver.findFirst({
                where: { car: vehicle.regNumber },
                select: { currentRideId: true }
              });

              return {
                ...vehicle,
                isBusy: driver ? driver.currentRideId !== null : false,
                estimatedExtraTime: 0 // Strategy already accounts for this
              };
            }));

            // Sort by distance if pickup location is provided
            let sortedVehicles = vehiclesWithStatus;
            if (pickupLat && pickupLon) {
              const pickupLatNum = parseFloat(pickupLat);
              const pickupLonNum = parseFloat(pickupLon);
        
              sortedVehicles = vehiclesWithStatus
                .map(vehicle => {
                  if (vehicle.lastLat && vehicle.lastLon) {
                    const distance = calculateDistance(
                      vehicle.lastLat,
                      vehicle.lastLon,
                      pickupLatNum,
                      pickupLonNum
                    );
                    return { ...vehicle, distance };
                  }
                  return { ...vehicle, distance: Infinity };
                })
                .sort((a, b) => a.distance - b.distance);
            }
        
            return NextResponse.json({ ok: true, vehicles: sortedVehicles });
          }
        }
      } catch (strategyError) {
        console.warn('Strategy API failed, falling back to all vehicles:', strategyError);
      }
    }

    // Fallback: Get all online drivers with their car assignments and current ride status
    let onlineDrivers: OnlineDriver[];
    try {
      onlineDrivers = await (prisma as any).comDriver.findMany({
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
    } catch (driverError) {
      console.error('Error fetching drivers in fallback:', driverError);
      return NextResponse.json({ ok: true, vehicles: [] });
    }

    if (onlineDrivers.length === 0) {
      console.log('No online drivers found in fallback');
      return NextResponse.json({ ok: true, vehicles: [] });
    }

    const carPlates = onlineDrivers.map((d: OnlineDriver) => d.car).filter((car): car is string => car !== null);

    // Get vehicles with location data
    let vehicles: any[];
    try {
      vehicles = await (prisma as any).comVehicles.findMany({
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
    } catch (vehicleError) {
      console.error('Error fetching vehicles in fallback:', vehicleError);
      return NextResponse.json({ ok: true, vehicles: [] });
    }

    // Batch query current rides for busy drivers
    const busyDrivers = onlineDrivers.filter(d => d.currentRideId !== null);
    const rideIds = busyDrivers.map(d => d.currentRideId!);
    let ridesMap = new Map<number, { dropoffAddress: string; status: string }>();

    if (rideIds.length > 0) {
      try {
        const rides = await prisma.ride.findMany({
          where: { id: { in: rideIds } },
          select: {
            id: true,
            dropoffAddress: true,
            status: true
          }
        });
        ridesMap = new Map(rides.map(r => [r.id, { dropoffAddress: r.dropoffAddress, status: r.status }]));
      } catch (ridesError) {
        console.warn('Failed to batch query rides:', ridesError);
      }
    }

    // Add busy status and calculate accurate remaining time for each vehicle
    const vehiclesWithStatus: VehicleWithStatus[] = await Promise.all(vehicles.map(async (vehicle: any) => {
      const driver = onlineDrivers.find((d: OnlineDriver) => d.car === vehicle.regNumber);
      const isBusy = driver ? driver.currentRideId !== null : false;

      let estimatedExtraTime = 0;

      if (isBusy && driver?.currentRideId) {
        const currentRide = ridesMap.get(driver.currentRideId);

        if (currentRide && currentRide.dropoffAddress && vehicle.lastLat && vehicle.lastLon) {
          // Geocode the dropoff address with timeout and better error handling
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const geocodeResponse = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(currentRide.dropoffAddress)}&countrycodes=dk&limit=1`,
              {
                headers: {
                  'User-Agent': '944-Taxi-App/1.0'
                },
                signal: controller.signal
              }
            );

            clearTimeout(timeoutId);

            if (geocodeResponse.ok) {
              const geocodeData = await geocodeResponse.json();
              if (geocodeData && geocodeData.length > 0) {
                const dropoffLat = parseFloat(geocodeData[0].lat);
                const dropoffLon = parseFloat(geocodeData[0].lon);

                // Calculate remaining distance from current location to dropoff
                const remainingDistance = calculateDistance(
                  vehicle.lastLat,
                  vehicle.lastLon,
                  dropoffLat,
                  dropoffLon
                );

                // Estimate remaining time (30 km/h average speed)
                estimatedExtraTime = Math.ceil((remainingDistance / 30) * 60);
              } else {
                console.warn(`No geocoding results for address: ${currentRide.dropoffAddress}`);
                estimatedExtraTime = 15;
              }
            } else {
              console.warn(`Geocoding failed with status: ${geocodeResponse.status} for address: ${currentRide.dropoffAddress}`);
              estimatedExtraTime = 15;
            }
          } catch (geocodeError: any) {
            if (geocodeError.name === 'AbortError') {
              console.warn('Geocoding timed out for address:', currentRide.dropoffAddress);
            } else {
              console.warn('Failed to geocode dropoff address:', geocodeError);
            }
            estimatedExtraTime = 15;
          }
        } else {
          console.warn('Missing ride details or vehicle location for driver:', driver.id);
          estimatedExtraTime = 15;
        }
      }

      return {
        ...vehicle,
        isBusy,
        estimatedExtraTime
      };
    }));

    return NextResponse.json({ ok: true, vehicles: vehiclesWithStatus });
  } catch (e: any) {
    console.error('Failed to fetch available vehicles:', e?.stack || e?.message || e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch available vehicles' }, { status: 500 });
  }
}