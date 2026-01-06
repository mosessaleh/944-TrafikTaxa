import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { signToken } from '@/lib/auth';

const prisma = new PrismaClient();

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, startKM } = await request.json();
    console.log('Driver login attempt:', { username, startKM }); // Log username and startKM, not password

    if (!username || !password || startKM === undefined) {
      return NextResponse.json(
        { error: 'Username, password, and startKM are required' },
        {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Find driver by username
    const driver = await prisma.comDriver.findUnique({
      where: { drUsername: username },
    });
    console.log('Driver found:', !!driver);

    if (!driver) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, driver.drPass);
    console.log('Password valid:', isValidPassword);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        {
          status: 401,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check if driver is active
    console.log('Driver active:', driver.isActive);
    if (!driver.isActive) {
      return NextResponse.json(
        { error: 'Driver account is not active' },
        {
          status: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check odometer reading against last recorded endKM
    const lastShift = await prisma.driversvagt.findFirst({
      where: { drId: driver.id },
      orderBy: { date: 'desc' },
    });

    // Temporarily disable odometer validation for debugging
    /*
    if (lastShift && lastShift.endKM !== null) {
      console.log('Last shift endKM:', lastShift.endKM, 'startKM:', startKM);
      if (startKM < lastShift.endKM) {
        return NextResponse.json(
          { error: 'Odometer reading is invalid - lower than last recorded reading', message: 'Invalid odometer reading' },
          {
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          }
        );
      }

      // Calculate days difference
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastShiftDate = new Date(lastShift.date);
      lastShiftDate.setHours(0, 0, 0, 0);

      const daysDifference = Math.ceil((today.getTime() - lastShiftDate.getTime()) / (1000 * 60 * 60 * 24));
      const maxAllowedKm = lastShift.endKM + (daysDifference * 750);
      console.log('Days difference:', daysDifference, 'maxAllowedKm:', maxAllowedKm, 'startKM:', startKM);

      if (startKM > maxAllowedKm) {
        return NextResponse.json(
          {
            error: 'Odometer reading is invalid - significant difference compared to last login',
            message: 'Invalid odometer reading - significant difference compared to last login'
          },
          {
            status: 400,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          }
        );
      }
    }
    */

    // Check if driver has an active shift (not ended)
    const existingActiveShift = await prisma.driversvagt.findFirst({
      where: {
        drId: driver.id,
        endVagt: null // Shift hasn't ended yet
      },
      orderBy: {
        date: 'desc' // Get the most recent active shift
      }
    });

    let shift;
    if (existingActiveShift) {
      // Use existing active shift
      shift = existingActiveShift;
      console.log(`Using existing active shift for driver ${driver.id}, started at ${shift.startVagt}`);
    } else {
      // Create new driversvagt record
      const now = new Date();
      shift = await prisma.driversvagt.create({
        data: {
          drId: driver.id,
          startVagt: now as any, // DateTime object
          date: now,
          salary: 0, // Will be calculated later
          hourSalary: 0, // Will be calculated later
          startKM: startKM,
          endKM: startKM, // Initially same as start
          deffKM: 0, // Initially 0
        },
      });
      console.log(`Created new shift for driver ${driver.id}`);
    }

    const token = signToken({ driverId: driver.id, type: 'driver' });

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      token: token,
      driver: {
        id: driver.id,
        name: `${driver.drFname} ${driver.drLname}`,
        car: driver.car,
      },
      shiftId: shift.id,
      shiftStartTime: shift.startVagt ? shift.startVagt.toISOString() : null,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Driver login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}