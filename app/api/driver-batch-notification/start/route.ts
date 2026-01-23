import { NextRequest, NextResponse } from 'next/server';
import { sendPushToDriver } from '@/lib/notification-service';

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
    console.log('Starting batch notification for driverId:', driverId);

    if (!driverId) {
      console.log('Driver ID is required');
      return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
    }

    // Stop existing interval if any
    const existingInterval = global.batchNotificationIntervals?.get(driverId);
    if (existingInterval) {
      console.log('Clearing existing interval for driverId:', driverId);
      clearInterval(existingInterval);
    }

    // Start new interval
    const interval = setInterval(async () => {
      console.log('Sending batch notification to driverId:', driverId);
      try {
        await sendPushToDriver(driverId, 'Batch Notification', 'This is a batch notification every 15 seconds');
        console.log('Batch notification sent successfully to driverId:', driverId);
      } catch (error) {
        console.error('Error sending batch notification to driverId:', driverId, error);
      }
    }, 15000); // 15 seconds

    global.batchNotificationIntervals?.set(driverId, interval);
    console.log('Batch notification interval started for driverId:', driverId);

    return NextResponse.json({ success: true, message: 'Batch notification started' });
  } catch (error) {
    console.error('Error starting batch notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}