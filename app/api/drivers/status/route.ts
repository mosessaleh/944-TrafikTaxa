import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    try {
      await requireAdmin();
    } catch (authError: any) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: authError?.status || 401 });
    }

    // Get all drivers with their status
    const drivers = await prisma.comDriver.findMany({
      select: {
        id: true,
        drFname: true,
        drLname: true,
        isOnline: true,
        isBusy: true,
        currentRideId: true,
        rating: true,
        car: true,
        lastLocation: true,
      }
    });

    // Get all rides that are active (not completed/canceled)
    const activeRides = await prisma.ride.findMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'CANCELED']
        }
      },
      select: {
        id: true,
        status: true,
        driverId: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupTime: true,
      }
    });

    return NextResponse.json({
      ok: true,
      drivers,
      rides: activeRides
    });

  } catch (e: any) {
    console.error('Error fetching drivers status:', e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch drivers status' }, { status: 500 });
  }
}
