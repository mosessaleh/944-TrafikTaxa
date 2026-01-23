import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';

const prismaAny = prisma as any;

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pushToken } = await request.json();

    if (!pushToken) {
      return NextResponse.json({ error: 'Push token is required' }, { status: 400 });
    }

    // Update user's push token
    await prismaAny.user.update({
      where: { id: user.id },
      data: { pushToken },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}