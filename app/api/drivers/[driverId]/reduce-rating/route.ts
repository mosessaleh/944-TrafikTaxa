import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const ReduceRatingSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

export async function POST(req: NextRequest, { params }: { params: { driverId: string } }) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    const { amount } = ReduceRatingSchema.parse(await req.json());

    // Get current driver rating
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { rating: true }
    });

    if (!driver) {
      return NextResponse.json({ ok: false, error: 'Driver not found' }, { status: 404 });
    }

    const newRating = Math.max(0, Number(driver.rating) - amount); // Ensure rating doesn't go below 0

    // Update the driver rating and clear current ride
    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        rating: newRating,
        currentRideId: null
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Driver rating reduced successfully',
      driver: { id: updatedDriver.id, rating: updatedDriver.rating, currentRideId: updatedDriver.currentRideId }
    });

  } catch (e: any) {
    console.error('Error reducing driver rating:', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}