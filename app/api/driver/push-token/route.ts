import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.AUTH_SECRET!) as any;

    if (!decoded.driverId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { pushToken } = await request.json();

    if (!pushToken) {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    // Update driver's push token
    console.log('Updating push token for driverId:', decoded.driverId);
    await prisma.$executeRaw`UPDATE comDriver SET expoPushToken = ${pushToken} WHERE id = ${decoded.driverId}`;
    console.log('Push token updated successfully for driverId:', decoded.driverId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
