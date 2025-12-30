import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: { driverId: string } }) {
  try {
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok: false }, { status: 401 });

    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ ok: false, error: 'Invalid driver ID' }, { status: 400 });
    }

    // Check if user is the driver or admin
    const isAdmin = (u as any).role === 'ADMIN' || (u as any).type === 'admin';
    if (!isAdmin && u.id !== driverId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { rideId } = body;

    if (!rideId) {
      return NextResponse.json({ ok: false, error: 'Ride ID required' }, { status: 400 });
    }

    // Check if driver has this ride assigned
    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      select: { currentRideId: true, rideAccepted: true }
    });

    if (!driver || driver.currentRideId !== rideId) {
      return NextResponse.json({ ok: false, error: 'Ride not assigned to this driver' }, { status: 400 });
    }

    // Clear the ride assignment
    await prisma.comDriver.update({
      where: { id: driverId },
      data: {
        currentRideId: null,
        rideAccepted: 0
      }
    });

    console.log(`Driver ${driverId} rejected ride ${rideId}`);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Error rejecting ride:', e);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}