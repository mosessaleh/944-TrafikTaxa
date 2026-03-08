import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT, requireAdmin } from '@/lib/auth';

export async function GET(
  req: Request,
  { params }: { params: { driverId: string } }
) {
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const driver = await requireDriverByJWT(req);
        authedDriverId = driver.id;
      } catch (authError: any) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: authError?.status || 401 });
      }
    }

    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    if (!isAdmin && authedDriverId !== driverId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        drFname: true,
        drLname: true,
        isOnline: true,
        isBusy: true,
        currentRideId: true,
        rideAccepted: true,
        rating: true,
        car: true,
        lastLocation: true,
      }
    });

    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      driver
    });

  } catch (error) {
    console.error('Error fetching driver status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
