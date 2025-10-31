import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok: false }, { status: 401 });

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ ok: false, error: 'Invalid booking ID' }, { status: 400 });
    }

    const booking = await prisma.ride.findUnique({
      where: { id: bookingId, userId: u.id },
      include: { vehicleType: true }
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ride: booking });
  } catch (e: any) {
    console.error('Error fetching booking:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}