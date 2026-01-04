import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { RealtimeMessage } from '@/lib/realtime';
const realtimeService = require('../../../lib/realtime-service');

export async function GET(request: NextRequest) {
  const user = await getUserFromCookie();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Register the connection
      realtimeService.addConnection(connectionId, controller, user.id);

      // Send initial connected event
      const connectedMessage: RealtimeMessage = {
        type: 'pong',
        payload: { message: 'connected', connectionId }
      };

      try {
        controller.enqueue(encoder.encode(`event: connected\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectedMessage)}\n\n`));
      } catch (error) {
        console.error('Error sending initial SSE message:', error);
        controller.close();
        return;
      }

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          const pingMessage: RealtimeMessage = {
            type: 'pong',
            payload: { timestamp: new Date().toISOString() }
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(pingMessage)}\n\n`));
        } catch (error) {
          console.error('Error sending ping:', error);
          clearInterval(pingInterval);
          controller.close();
        }
      }, 30000); // 30 seconds

      // Clean up on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        realtimeService.removeConnection(connectionId);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromCookie();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, bookingId, connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    switch (action) {
      case 'subscribe':
        if (!bookingId) {
          return NextResponse.json({ error: 'bookingId required for subscribe' }, { status: 400 });
        }
        realtimeService.subscribeToBooking(connectionId, bookingId);
        return NextResponse.json({ success: true });

      case 'unsubscribe':
        if (!bookingId) {
          return NextResponse.json({ error: 'bookingId required for unsubscribe' }, { status: 400 });
        }
        realtimeService.unsubscribeFromBooking(connectionId, bookingId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in realtime POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}