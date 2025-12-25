import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  req: Request,
  { params }: { params: { driverId: string } }
) {
  try {
    const driverId = parseInt(params.driverId);
    if (isNaN(driverId)) {
      return NextResponse.json({ error: 'Invalid driver ID' }, { status: 400 });
    }

    const body = await req.json();
    const { currentRideId, isBusy, rideAccepted } = body;

    // Update driver
    const updateData: any = {};
    if (currentRideId !== undefined) updateData.currentRideId = currentRideId;
    if (isBusy !== undefined) updateData.isBusy = isBusy;
    if (rideAccepted !== undefined) updateData.rideAccepted = rideAccepted;

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