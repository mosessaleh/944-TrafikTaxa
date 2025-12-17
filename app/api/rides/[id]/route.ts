import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    // Get ride details
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          }
        },
        vehicleType: {
          select: {
            id: true,
            title: true,
            capacity: true,
          }
        }
      }
    });

    if (!ride) {
      return NextResponse.json({ ok: false, error: 'Ride not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      ride
    });

  } catch (e: any) {
    console.error('Error fetching ride details:', e);
    return NextResponse.json({ ok: false, error: 'Failed to fetch ride details' }, { status: 500 });
  }
}