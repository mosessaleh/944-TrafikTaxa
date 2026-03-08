import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireDriverByJWT, requireAdmin } from '@/lib/auth';

export async function PUT(
  req: Request,
  { params }: { params: { driverId: string } }
) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    let isAdmin = false;
    let authedDriverId: number | null = null;

    try {
      const adminUser = await requireAdmin();
      if (adminUser) {
        isAdmin = true;
      }
    } catch {
      // Not an admin cookie session; try driver JWT
    }

    if (!isAdmin) {
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      try {
        const driver = await requireDriverByJWT(req);
        authedDriverId = driver.id;
      } catch (authError: any) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: authError?.status || 401 });
      }
    }

    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    if (!isAdmin && authedDriverId !== driverId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { currentRideId, isBusy, rideAccepted } = body;

    // Update driver
    const updateData: any = {};
    if (currentRideId !== undefined) {
      const parsedRideId = Number(currentRideId);
      if (!Number.isInteger(parsedRideId) || parsedRideId < 0) {
        return NextResponse.json({ error: 'Invalid currentRideId' }, { status: 400 });
      }
      updateData.currentRideId = parsedRideId === 0 ? null : parsedRideId;
    }

    if (isBusy !== undefined) {
      if (typeof isBusy !== 'boolean') {
        return NextResponse.json({ error: 'Invalid isBusy value' }, { status: 400 });
      }
      updateData.isBusy = isBusy;
    }

    if (rideAccepted !== undefined) {
      const parsedRideAccepted = Number(rideAccepted);
      if (!Number.isInteger(parsedRideAccepted) || (parsedRideAccepted !== 0 && parsedRideAccepted !== 1)) {
        return NextResponse.json({ error: 'Invalid rideAccepted value' }, { status: 400 });
      }
      updateData.rideAccepted = parsedRideAccepted;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updatedDriver = await prisma.comDriver.update({
      where: { id: driverId },
      data: updateData,
      select: {
        id: true,
        currentRideId: true,
        isBusy: true,
        rideAccepted: true
      }
    });

    // Send real-time update to driver
    if ((global as any).io) {
      console.log(`Emitting driverStatusUpdate to room driver_${driverId}`);
      (global as any).io.to(`driver_${driverId}`).emit('driverStatusUpdate', {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted
      });
      console.log(`Sent driverStatusUpdate to driver ${driverId}:`, {
        currentRideId: updatedDriver.currentRideId,
        isBusy: updatedDriver.isBusy,
        rideAccepted: updatedDriver.rideAccepted
      });
    } else {
      console.log('Global io not available for emitting');
    }

    return NextResponse.json({
      ok: true,
      driver: updatedDriver
    });

  } catch (error) {
    console.error('Error updating driver ride:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
