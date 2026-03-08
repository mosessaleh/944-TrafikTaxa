import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, requireDriverByJWT } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { driverId: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    let isAdmin = false;
    let authedDriverId: number | null = null;

    try {
      const adminUser = await requireAdmin();
      if (adminUser) {
        isAdmin = true;
      }
    } catch {
      // Not admin cookie session; fallback to driver JWT
    }

    if (!isAdmin) {
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const driver = await requireDriverByJWT(req);
        authedDriverId = driver.id;
      } catch (authError: any) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: authError?.status || 401 });
      }
    }

    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    if (!isAdmin && authedDriverId !== driverId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
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
