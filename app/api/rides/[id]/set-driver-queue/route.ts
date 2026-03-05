import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { validateRequestOrigin } from '@/lib/security-headers';

const SetDriverQueueSchema = z.object({
  driverQueue: z.array(z.number().int().positive('Invalid driver ID')),
});

async function ensureAdmin(request: NextRequest) {
  const originCheck = validateRequestOrigin(request as any);
  if (!originCheck.ok) {
    return NextResponse.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  try {
    await requireAdmin();
    return null;
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: error?.status || 403 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const adminError = await ensureAdmin(req);
    if (adminError) return adminError;

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
