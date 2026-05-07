import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookingId = parseInt(params.id);
    if (isNaN(bookingId)) {
      return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 });
    }

    // Check if user owns this booking or is admin
    const booking = await prisma.ride.findUnique({
      where: { id: bookingId },
      select: { userId: true }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.userId !== me.id && (me.type !== 'user' || (me as any).role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Get the invoice ID for this booking
    const invoice = await prisma.invoice.findFirst({
      where: { rideId: bookingId },
      select: { id: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id
    });

  } catch (error) {
    console.error('Error getting invoice ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
