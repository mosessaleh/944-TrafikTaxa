import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    // Update the ride status to DISPATCHED
    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'DISPATCHED' },
    });

    return NextResponse.json({
      ok: true,
      message: 'Ride pickup started successfully',
      ride: { id: updatedRide.id, status: updatedRide.status }
    });

  } catch (e: any) {
    console.error('Error starting ride pickup:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}