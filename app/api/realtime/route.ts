import { NextRequest } from 'next/server';
import { RealtimeManager, SSEManager } from '@/lib/realtime';

// WebSocket handler for real-time communication (Node.js server only)
// This endpoint will be handled by a custom server for WebSocket support
export async function GET(req: NextRequest) {
  // For now, return SSE fallback
  const userId = req.headers.get('x-user-id'); // This would be set by middleware

  if (!userId) {
    return new Response('Authentication required', { status: 401 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add client to SSE manager
      const clientId = SSEManager.addClient(userId, {
        write: (chunk: string) => controller.enqueue(new TextEncoder().encode(chunk)),
        end: () => controller.close(),
      });

      // Clean up on abort
      req.signal.addEventListener('abort', () => {
        SSEManager.removeClient(clientId);
        controller.close();
      });
    },
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

// Fallback SSE endpoint for browsers without WebSocket support
export async function POST(req: NextRequest) {
  const { action } = await req.json();

  switch (action) {
    case 'stats':
      const stats = RealtimeManager.getStats();
      return Response.json(stats);

    default:
      return Response.json({ error: 'Unknown action' }, { status: 400 });
  }
}