import { NextRequest, NextResponse } from 'next/server';
import { requireDriverByJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Verify driver authentication
    const driver = await requireDriverByJWT(request as any);

    // Get end KM from request body
    const body = await request.json();
    const { endKM } = body;

    // Validate endKM
    if (typeof endKM !== 'number' || endKM < 0) {
      return NextResponse.json(
        { error: 'Valid end KM is required' },
        { status: 400 }
      );
    }

    // Find the current shift (today's shift that hasn't ended yet)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentShift = await prisma.driversvagt.findFirst({
      where: {
        drId: driver.id,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        endVagt: null // Shift hasn't ended yet
      }
    });

    if (!currentShift) {
      return NextResponse.json(
        { error: 'No active shift found for today' },
        { status: 404 }
      );
    }

    const endTime = new Date();

    // Calculate work time in hours
    const startTime = currentShift.startVagt;
    if (!startTime) {
      return NextResponse.json(
        { error: 'Shift start time not found' },
        { status: 400 }
      );
    }

    // Ensure startTime is a Date object
    const startDateTime = new Date(startTime);
    const workTimeMs = endTime.getTime() - startDateTime.getTime();
    const workTimeHours = workTimeMs / (1000 * 60 * 60); // Convert to hours

    // Calculate distance difference
    const deffKM = endKM - currentShift.startKM;

    // Get all rides completed today during this shift
    const shiftRides = await prisma.ride.findMany({
      where: {
        driverId: driver.id,
        status: 'COMPLETED',
        createdAt: {
          gte: startTime,
          lte: endTime
        }
      },
      select: {
        price: true
      }
    });

    // Calculate total salary from rides
    const totalSalary = shiftRides.reduce((sum, ride) => sum + ride.price, 0);

    // Calculate hourly salary
    const hourSalary = workTimeHours > 0 ? totalSalary / workTimeHours : 0;

    // Update the shift record
    await prisma.driversvagt.update({
      where: { id: currentShift.id },
      data: {
        endVagt: endTime.toISOString(),
        endKM: endKM,
        deffKM: deffKM,
        workTime: workTimeHours,
        salary: totalSalary,
        hourSalary: hourSalary
      }
    });

    // Set driver as offline
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: { isOnline: false }
    });

    console.log('Ending shift for driver:', driver.id, 'shiftData:', {
      workTime: workTimeHours,
      totalSalary: totalSalary,
      hourSalary: hourSalary,
      distance: deffKM,
      ridesCount: shiftRides.length
    });

    return NextResponse.json({
      success: true,
      message: 'Shift ended successfully',
      shiftData: {
        workTime: workTimeHours,
        totalSalary: totalSalary,
        hourSalary: hourSalary,
        distance: deffKM,
        ridesCount: shiftRides.length
      }
    });

  } catch (error) {
    console.error('End shift error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}