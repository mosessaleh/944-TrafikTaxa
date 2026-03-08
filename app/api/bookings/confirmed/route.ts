import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: e?.status || 403 });
  }

  try {
    // Get confirmed bookings (rides with status CONFIRMED)
    const confirmedBookings = await prisma.ride.findMany({
      where: {
        status: 'CONFIRMED'
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
          }
        }
      },
      orderBy: {
        pickupTime: 'asc'
      }
    });

    return NextResponse.json({
      ok: true,
      bookings: confirmedBookings
    });

  } catch (e: any) {
    console.error('Error fetching confirmed bookings:', e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch confirmed bookings' }, { status: 500 });
  }
}
