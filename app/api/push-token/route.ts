import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Expo } from 'expo-server-sdk';

const prismaAny = prisma as any;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pushToken } = await request.json();

    if (!pushToken || typeof pushToken !== 'string') {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    const normalizedPushToken = pushToken.trim();
    if (!Expo.isExpoPushToken(normalizedPushToken)) {
      return NextResponse.json({ error: 'Invalid Expo push token' }, { status: 400 });
    }

    // Update user's push token
    await prismaAny.user.update({
      where: { id: user.id },
      data: { pushToken: normalizedPushToken },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
