import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const SetDriverQueueSchema = z.object({
  driverQueue: z.array(z.number().int().positive('Invalid vehicle ID')),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rideId = parseInt(params.id);
    if (isNaN(rideId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ride ID' }, { status: 400 });
    }

    const { driverQueue } = SetDriverQueueSchema.parse(await req.json());

    // Update the ride with the driver queue
    const updatedRide = await prisma.ride.update({
      where: { id: rideId },
      data: { driverQueue: driverQueue },
    });

    return NextResponse.json({
      ok: true,
      message: 'Driver queue set successfully',
      ride: { id: updatedRide.id, driverQueue: updatedRide.driverQueue }
    });

  } catch (e: any) {
    console.error('Error setting driver queue:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}