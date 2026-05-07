import { NextRequest, NextResponse } from 'next/server';
import { requireDriverByJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Verify driver authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      var driver = await requireDriverByJWT(request as any);
    } catch (error: any) {
      console.warn('driver/location-update: authentication failed', { message: error?.message });
      return NextResponse.json(
        { error: error.message || 'Invalid or expired token' },
        { status: error.status || 401 }
      );
    }

    // Get location data from request body
    const body = await request.json();
    const { latitude, longitude, timestamp } = body;

    // Validate required fields
    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid latitude or longitude values' },
        { status: 400 }
      );
    }

    // Update driver's vehicle location in database
    const updateData: any = {
      lastLat: latitude,
      lastLon: longitude,
      lastLocationUpdate: timestamp ? new Date(timestamp) : new Date(),
    };

    // Find the vehicle assigned to this driver
    const vehicle = await (prisma as any).comVehicles.findFirst({
      where: {
        regNumber: driver.car, // Driver's assigned car
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: 'No active vehicle found for this driver' },
        { status: 404 }
      );
    }

    // Update vehicle location
    await (prisma as any).comVehicles.update({
      where: { id: vehicle.id },
      data: updateData,
    });

    // Also update driver's lastLocation
    await (prisma as any).comDriver.update({
      where: { id: driver.id },
      data: {
        lastLocation: [latitude, longitude],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
      timestamp: updateData.lastLocationUpdate,
    });
  } catch (error: any) {
    console.error('driver/location-update: error', { message: error?.message });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
