import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok: false }, { status: 401 });

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ ok: false, error: 'Invalid booking ID' }, { status: 400 });
    }

    const body = await req.json();
    const { explanation } = body;

    // Check if user is admin or owns the booking
    const isAdmin = (u as any).role === 'ADMIN' || (u as any).type === 'admin';
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: { userId: true }
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
    }

    if (!isAdmin && booking.userId !== u.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Update the booking
    const updatedBooking = await prisma.ride.update({
      where: { id: bookingId },
      data: { explanation }
    });

    return NextResponse.json({ ok: true, ride: updatedBooking });
  } catch (e: any) {
    console.error('Error updating booking:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok: false }, { status: 401 });

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ ok: false, error: 'Invalid booking ID' }, { status: 400 });
    }

    // Check if user is admin or force access is requested
    const url = new URL(req.url);
    const forceAccess = url.searchParams.get('force') === 'true';
    const isAdmin = (u as any).role === 'ADMIN' || (u as any).type === 'admin';

    const booking = await prisma.ride.findUnique({
      where: (isAdmin || forceAccess) ? { id: bookingId } : { id: bookingId, userId: u.id },
      include: { vehicleType: true }
    });

    if (forceAccess) {
      console.warn('Force access enabled for booking API', bookingId, '- use only for development!');
    }

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ride: booking });
  } catch (e: any) {
    console.error('Error fetching booking:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}