import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculateDistance } from '@/lib/distance';

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

    // Add busy status and calculate accurate remaining time for each vehicle
    const vehiclesWithStatus = await Promise.all(vehicles.map(async (vehicle) => {
      const driver = onlineDrivers.find(d => d.car === vehicle.regNumber);
      const isBusy = driver ? driver.currentRideId !== null : false;

      let estimatedExtraTime = 0;

      if (isBusy && driver?.currentRideId) {
        try {
          // Get the current ride details
          const currentRide = await prisma.ride.findUnique({
            where: { id: driver.currentRideId },
            select: {
              dropoffAddress: true,
              status: true
            }
          });

          if (currentRide && currentRide.dropoffAddress && vehicle.lastLat && vehicle.lastLon) {
            // Geocode the dropoff address to get coordinates using Nominatim (OpenStreetMap)
            try {
              const geocodeResponse = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(currentRide.dropoffAddress)}&countrycodes=dk&limit=1`,
                {
                  headers: {
                    'User-Agent': '944-Taxi-App/1.0'
                  }
                }
              );

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
                }
              }
            } catch (geocodeError) {
              console.warn('Failed to geocode dropoff address:', geocodeError);
              // Fallback to default estimate
              estimatedExtraTime = 15;
            }
          }
        } catch (rideError) {
          console.warn('Failed to get current ride details:', rideError);
          estimatedExtraTime = 15; // Fallback
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