import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { driverId: string } }) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    // Get driver details
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      include: {
        company: {
          select: {
            id: true,
            comName: true,
            comPhone: true,
            comEmail: true,
          }
        }
      }
    });

    if (!driver) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    // Get vehicle details if driver has a car assigned
    let vehicle = null;
    if (driver.car) {
      vehicle = await (prisma as any).comVehicles.findFirst({
        where: { regNumber: driver.car }
      });

      // Get vehicle type details if vehicle exists
      if (vehicle && vehicle.vehicleType) {
        const vehicleType = await (prisma as any).VehicleType.findFirst({
          where: { key: vehicle.vehicleType }
        });
        vehicle = { ...vehicle, vehicleType };
      }
    }

    return NextResponse.json({
      ok: true,
      driver: {
        ...driver,
        vehicle
      }
    });

  } catch (e: any) {
    console.error('Error fetching driver details:', e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch driver details' }, { status: 500 });
  }
}