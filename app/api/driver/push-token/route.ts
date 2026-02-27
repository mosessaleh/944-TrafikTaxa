import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Expo } from 'expo-server-sdk';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const driverId = Number(decoded?.driverId ?? decoded?.id);

    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { pushToken } = await request.json();

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    const normalizedPushToken = pushToken.trim();
    if (!Expo.isExpoPushToken(normalizedPushToken)) {
      return NextResponse.json({ error: 'Invalid Expo push token' }, { status: 400 });
    }

    // Update driver's push token
    console.log('Updating push token for driverId:', driverId);
    await prisma.comDriver.update({
      where: { id: driverId },
      data: { expoPushToken: normalizedPushToken },
    });
    console.log('Push token updated successfully for driverId:', driverId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
