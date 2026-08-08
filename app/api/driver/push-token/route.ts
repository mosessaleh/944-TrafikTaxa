import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verify, TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';
import { Expo } from 'expo-server-sdk';
import { checkTokenBlacklist, getAuthSecret } from '@/lib/auth';

const prisma = new PrismaClient();
const JWT_SECRET = getAuthSecret();

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded: any;

    try {
      decoded = verify(token, JWT_SECRET) as any;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 });
      }
      if (error instanceof JsonWebTokenError || error instanceof NotBeforeError) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      throw error;
    }

    const driverId = Number(decoded?.driverId ?? decoded?.id);

    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const jti = decoded?.jti;
    if (jti) {
      const isBlacklisted = await checkTokenBlacklist(jti);
      if (isBlacklisted) {
        return NextResponse.json({ error: 'Token has been revoked' }, { status: 401 });
      }
    }

    const { pushToken } = await request.json();

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    const normalizedPushToken = pushToken.trim();
    if (!Expo.isExpoPushToken(normalizedPushToken)) {
      return NextResponse.json({ error: 'Invalid Expo push token' }, { status: 400 });
    }

    // Update driver's push token — first remove from any other driver
    console.log('Updating push token for driverId:', driverId);
    try {
      await prisma.comDriver.updateMany({
        where: {
          expoPushToken: normalizedPushToken,
          id: { not: driverId }
        },
        data: { expoPushToken: null },
      });
    } catch {}
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
