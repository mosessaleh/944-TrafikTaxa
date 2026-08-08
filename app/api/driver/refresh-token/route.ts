import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken, getClientIp } from '@/lib/session-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const result = await refreshAccessToken(refreshToken, clientIp);

    if (!result) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      token: result.accessToken,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      driverId: result.driverId,
    });
  } catch (error: any) {
    console.error('refresh-token: error', { message: error?.message });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
