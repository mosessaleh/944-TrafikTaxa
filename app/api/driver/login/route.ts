import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { username, password, startKM } = await request.json();

    if (!username || !password || startKM === undefined) {
      return NextResponse.json(
        { error: 'Username, password, and startKM are required' },
        { status: 400 }
      );
    }

    // Find driver by username
    const driver = await prisma.comDriver.findUnique({
      where: { drUsername: username },
    });

    if (!driver) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, driver.drPass);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if driver is active
    if (!driver.isActive) {
      return NextResponse.json(
        { error: 'Driver account is not active' },
        { status: 403 }
      );
    }

    // Check odometer reading against last recorded endKM
    const lastShift = await prisma.driversvagt.findFirst({
      where: { drId: driver.id },
      orderBy: { date: 'desc' },
    });

    if (lastShift && lastShift.endKM !== null) {
      if (startKM < lastShift.endKM) {
        return NextResponse.json(
          { error: 'Odometer reading is invalid - lower than last recorded reading', message: 'Invalid odometer reading' },
          { status: 400 }
        );
      }

      // Calculate days difference
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastShiftDate = new Date(lastShift.date);
      lastShiftDate.setHours(0, 0, 0, 0);

      const daysDifference = Math.ceil((today.getTime() - lastShiftDate.getTime()) / (1000 * 60 * 60 * 24));
      const maxAllowedKm = lastShift.endKM + (daysDifference * 750);

      if (startKM > maxAllowedKm) {
        return NextResponse.json(
          {
            error: 'Odometer reading is invalid - significant difference compared to last login',
            message: 'Invalid odometer reading - significant difference compared to last login'
          },
          { status: 400 }
        );
      }
    }

    // Set driver as online
    await prisma.comDriver.update({
      where: { id: driver.id },
      data: { isOnline: true },
    });

    // Create driversvagt record
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0); // Set to start of day

    // Format time as HH:MM:SS
    const currentTime = now.toTimeString().split(' ')[0];

    const shift = await prisma.driversvagt.create({
      data: {
        drId: driver.id,
        startVagt: currentTime,
        date: today,
        salary: 0, // Will be calculated later
        hourSalary: 0, // Will be calculated later
        startKM: startKM,
        endKM: startKM, // Initially same as start
        deffKM: 0, // Initially 0
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      driver: {
        id: driver.id,
        name: `${driver.drFname} ${driver.drLname}`,
        car: driver.car,
      },
      shiftId: shift.id,
    });

  } catch (error) {
    console.error('Driver login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}