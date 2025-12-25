import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vehicleId = parseInt(params.id);
    if (isNaN(vehicleId)) {
      return NextResponse.json({ error: 'Invalid vehicle ID' }, { status: 400 });
    }

    // Get vehicle details
    const vehicle = await prisma.comVehicles.findUnique({
      where: { id: vehicleId },
      select: { id: true, regNumber: true }
    });

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    // Find active online driver for this vehicle
    const driver = await prisma.comDriver.findFirst({
      where: {
        car: vehicle.regNumber,
        isOnline: true,
        isActive: true
      },
      select: {
        id: true,
        drUsername: true,
        car: true,
        isOnline: true,
        isActive: true,
        currentRideId: true,
        rideAccepted: true,
        isBusy: true
      }
    });

    return NextResponse.json({
      ok: true,
      vehicle: vehicle,
      driver: driver
    });

  } catch (error) {
    console.error('Error fetching vehicle driver:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}