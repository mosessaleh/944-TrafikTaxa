import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const driver = await getUserFromCookie();
    if (!driver || driver.type !== 'driver') {
      return NextResponse.json(
        { ok: false, error: 'Driver authentication required' },
        { status: 401 }
      );
    }

    // Get available bookings (confirmed, paid, not assigned to driver or car)
    const availableBookings = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED',
        paymentMethod: { not: null },
        driverId: null,
        car: null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          }
        },
        vehicleType: {
          select: {
            id: true,
            title: true,
            capacity: true
          }
        }
      },
      orderBy: {
        pickupTime: 'asc'
      }
    });

    console.log(`[API] Driver ${driver.id} requested available bookings, found ${availableBookings.length} (filtered by new criteria)`);

    return NextResponse.json({
      ok: true,
      rides: availableBookings
    });

  } catch (error) {
    console.error('[API] Error fetching available bookings:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch available bookings' },
      { status: 500 }
    );
  }
}