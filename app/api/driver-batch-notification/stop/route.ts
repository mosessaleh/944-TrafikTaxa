import { NextRequest, NextResponse } from 'next/server';

// Global map to store intervals for each driver
declare global {
  var batchNotificationIntervals: Map<number, NodeJS.Timeout> | undefined;
}

if (!global.batchNotificationIntervals) {
  global.batchNotificationIntervals = new Map<number, NodeJS.Timeout>();
}

export async function POST(request: NextRequest) {
  try {
    const { driverId } = await request.json();
    console.log('Stopping batch notification for driverId:', driverId);

    if (!driverId) {
      console.log('Driver ID is required');
      return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
    }

    // Stop existing interval if any
    const existingInterval = global.batchNotificationIntervals?.get(driverId);
    if (existingInterval) {
      console.log('Clearing interval for driverId:', driverId);
      clearInterval(existingInterval);
      global.batchNotificationIntervals?.delete(driverId);
    } else {
      console.log('No interval found for driverId:', driverId);
    }

    return NextResponse.json({ success: true, message: 'Batch notification stopped' });
  } catch (error) {
    console.error('Error stopping batch notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}