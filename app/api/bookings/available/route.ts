import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate driver
    const driver = await getUserFromCookie();
    if (!driver || driver.type !== 'driver') {
      return NextResponse.json(
        { ok: false, error: 'Driver authentication required' },
        { status: 401 }
      );
    }

    // Note: This API is deprecated. New system uses WebSocket for real-time ride assignment.
    // Return empty array to indicate no rides available via polling
    console.log(`[API] Driver ${driver.id} requested available bookings via deprecated API. New system uses WebSocket.`);

    return NextResponse.json({
      ok: true,
      rides: [],
      message: 'Rides are now assigned via WebSocket. Please use the updated driver app.'
    });

  } catch (error) {
    console.error('[API] Error fetching available bookings:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch available bookings' },
      { status: 500 }
    );
  }
}