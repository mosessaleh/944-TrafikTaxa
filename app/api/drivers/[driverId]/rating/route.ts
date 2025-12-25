import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: { driverId: string } }
) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    const body = await req.json();
    const { deduct } = body;

    if (typeof deduct !== 'number') {
      return NextResponse.json({ error: 'Invalid deduct value' }, { status: 400 });
    }

    // Update driver rating
    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        rating: {
          decrement: deduct
        }
      },
      select: {
        id: true,
        rating: true
      }
    });

    return NextResponse.json({
      ok: true,
      driver: updatedDriver
    });

  } catch (error) {
    console.error('Error updating driver rating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}