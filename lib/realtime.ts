import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

// Types for real-time communication
export interface RealtimeMessage {
  type: 'booking_update' | 'driver_location' | 'chat_message' | 'notification' | 'ping' | 'pong' | 'error' | 'subscribe_booking' | 'subscribe_confirmed_bookings' | 'confirmed_bookings_update';
  payload: any;
  timestamp: number;
  userId?: string;
  bookingId?: number;
}

export interface BookingUpdatePayload {
  bookingId: number;
  status: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  eta?: number; // minutes
  location?: {
    lat: number;
    lng: number;
  };
}

export interface ChatMessagePayload {
  bookingId: number;
  fromUserId: string;
  toUserId: string;
  message: string;
  messageId: string;
  timestamp?: number;
}

export interface NotificationPayload {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionUrl?: string;
}

// WebSocket connection manager
export class RealtimeManager {
  private static connections = new Map<string, WebSocket>();
  private static bookingSubscriptions = new Map<number, Set<string>>();
  private static userSubscriptions = new Map<string, Set<WebSocket>>();
  private static confirmedBookingsSubscribers = new Set<string>();

  // Handle new WebSocket connection
  static async handleConnection(ws: WebSocket, request: IncomingMessage) {
    try {
      // Authenticate user from cookies
      const user = await this.authenticateUser(request);
      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }

      const userId = user.id.toString();
      this.connections.set(userId, ws);
      this.userSubscriptions.set(userId, new Set([ws]));

      console.log(`[Realtime] User ${userId} connected`);

      // Handle incoming messages
      ws.on('message', async (data: Buffer) => {
        try {
          const message: RealtimeMessage = JSON.parse(data.toString());
          await this.handleMessage(userId, message);
        } catch (error) {
          console.error('[Realtime] Error parsing message:', error);
          this.sendToUser(userId, {
            type: 'error',
            payload: { message: 'Invalid message format' },
            timestamp: Date.now(),
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`[Realtime] User ${userId} disconnected`);
        this.connections.delete(userId);
        this.userSubscriptions.delete(userId);

        // Remove from booking subscriptions
        for (const [bookingId, subscribers] of this.bookingSubscriptions) {
          subscribers.delete(userId);
          if (subscribers.size === 0) {
            this.bookingSubscriptions.delete(bookingId);
          }
        }

        // Remove from confirmed bookings subscribers
        this.confirmedBookingsSubscribers.delete(userId);
      });

      // Handle ping/pong for connection health
      ws.on('ping', () => {
        ws.pong();
      });

      // Send welcome message
      this.sendToUser(userId, {
        type: 'notification',
        payload: {
          id: 'welcome',
          type: 'info',
          title: 'Connected',
          message: 'Real-time connection established',
        } as NotificationPayload,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[Realtime] Connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  // Authenticate user from request cookies
  private static async authenticateUser(request: IncomingMessage): Promise<any> {
    // Extract session cookie from headers
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;

    // Parse cookies to find session
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const sessionToken = cookies.session;
    if (!sessionToken) return null;

    // Mock request object for getUserFromCookie
    const mockRequest = {
      headers: { get: (name: string) => request.headers[name] },
      cookies: { get: (name: string) => ({ value: cookies[name] }) },
    } as any;

    return await getUserFromCookie();
  }

  // Handle incoming messages
  private static async handleMessage(userId: string, message: RealtimeMessage) {
    switch (message.type) {
      case 'ping':
        this.sendToUser(userId, {
          type: 'pong',
          payload: {},
          timestamp: Date.now(),
        });
        break;

      case 'subscribe_booking':
        await this.subscribeToBooking(userId, message.payload.bookingId);
        break;

      case 'subscribe_confirmed_bookings':
        await this.subscribeToConfirmedBookings(userId);
        break;

      case 'chat_message':
        await this.handleChatMessage(userId, message.payload);
        break;

      default:
        console.warn(`[Realtime] Unknown message type: ${message.type}`);
    }
  }

  // Subscribe user to booking updates
  private static async subscribeToBooking(userId: string, bookingId: number) {
    try {
      // Verify user has access to this booking
      const booking = await prisma.ride.findFirst({
        where: {
          id: bookingId,
          userId: parseInt(userId),
        },
      });

      if (!booking) {
        this.sendToUser(userId, {
          type: 'error',
          payload: { message: 'Access denied to booking' },
          timestamp: Date.now(),
        });
        return;
      }

      // Add to subscription
      if (!this.bookingSubscriptions.has(bookingId)) {
        this.bookingSubscriptions.set(bookingId, new Set());
      }
      this.bookingSubscriptions.get(bookingId)!.add(userId);

      console.log(`[Realtime] User ${userId} subscribed to booking ${bookingId}`);

      this.sendToUser(userId, {
        type: 'notification',
        payload: {
          id: `subscribed_${bookingId}`,
          type: 'success',
          title: 'Subscribed',
          message: `Now receiving updates for booking #${bookingId}`,
        } as NotificationPayload,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[Realtime] Subscription error:', error);
      this.sendToUser(userId, {
        type: 'error',
        payload: { message: 'Failed to subscribe to booking' },
        timestamp: Date.now(),
      });
    }
  }

  // Subscribe user to confirmed bookings updates
  private static async subscribeToConfirmedBookings(userId: string) {
    try {
      // Add to confirmed bookings subscribers
      this.confirmedBookingsSubscribers.add(userId);

      console.log(`[Realtime] User ${userId} subscribed to confirmed bookings`);

      // Send current confirmed bookings immediately
      await this.sendCurrentConfirmedBookings(userId);

      this.sendToUser(userId, {
        type: 'notification',
        payload: {
          id: 'subscribed_confirmed_bookings',
          type: 'success',
          title: 'Subscribed to Confirmed Bookings',
          message: 'Now receiving real-time updates for new confirmed bookings',
        } as NotificationPayload,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[Realtime] Confirmed bookings subscription error:', error);
      this.sendToUser(userId, {
        type: 'error',
        payload: { message: 'Failed to subscribe to confirmed bookings' },
        timestamp: Date.now(),
      });
    }
  }

  // Send current confirmed bookings to a user
  private static async sendCurrentConfirmedBookings(userId: string) {
    try {
      const confirmedBookings = await prisma.ride.findMany({
        where: {
          status: 'CONFIRMED'
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            }
          },
          vehicleType: {
            select: {
              id: true,
              title: true,
            }
          }
        },
        orderBy: {
          pickupTime: 'asc'
        }
      });

      this.sendToUser(userId, {
        type: 'confirmed_bookings_update',
        payload: {
          bookings: confirmedBookings,
          action: 'initial_load'
        },
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[Realtime] Error sending current confirmed bookings:', error);
    }
  }

  // Handle chat messages
  private static async handleChatMessage(userId: string, payload: ChatMessagePayload) {
    try {
      // Verify user has access to the booking
      const booking = await prisma.ride.findFirst({
        where: {
          id: payload.bookingId,
          OR: [
            { userId: parseInt(userId) },
            // TODO: Add driver access check when driver model is available
          ],
        },
      });

      if (!booking) {
        this.sendToUser(userId, {
          type: 'error',
          payload: { message: 'Access denied' },
          timestamp: Date.now(),
        });
        return;
      }

      // Store chat message (you might want to create a ChatMessage model)
      console.log(`[Realtime] Chat message from ${userId} to booking ${payload.bookingId}: ${payload.message}`);

      // Broadcast to all subscribers of this booking
      const subscribers = this.bookingSubscriptions.get(payload.bookingId);
      if (subscribers) {
        const chatMessage: RealtimeMessage = {
          type: 'chat_message',
          payload: {
            ...payload,
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        };

        for (const subscriberId of subscribers) {
          if (subscriberId !== userId) { // Don't send back to sender
            this.sendToUser(subscriberId, chatMessage);
          }
        }
      }

    } catch (error) {
      console.error('[Realtime] Chat message error:', error);
    }
  }

  // Send booking update to all subscribers
  static async broadcastBookingUpdate(bookingId: number, update: BookingUpdatePayload) {
    const subscribers = this.bookingSubscriptions.get(bookingId);
    if (!subscribers) return;

    const message: RealtimeMessage = {
      type: 'booking_update',
      payload: update,
      timestamp: Date.now(),
    };

    for (const userId of subscribers) {
      this.sendToUser(userId, message);
    }

    console.log(`[Realtime] Broadcasted booking update for ${bookingId} to ${subscribers.size} subscribers`);
  }

  // Send notification to specific user
  static sendNotificationToUser(userId: string, notification: NotificationPayload) {
    const message: RealtimeMessage = {
      type: 'notification',
      payload: notification,
      timestamp: Date.now(),
      userId,
    };

    // WebSocket clients (if any are connected)
    this.sendToUser(userId, message);

    // SSE clients (Next.js /api/realtime SSE endpoint)
    SSEManager.sendToClient(userId, 'message', message);
  }

  // Send message to specific user
  private static sendToUser(userId: string, message: RealtimeMessage) {
    const connections = this.userSubscriptions.get(userId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      }
    }
  }

  // Update driver location for booking
  static async updateDriverLocation(bookingId: number, location: { lat: number; lng: number }) {
    await this.broadcastBookingUpdate(bookingId, {
      bookingId,
      status: 'location_update',
      location,
    });
  }

  // Update booking status
  static async updateBookingStatus(bookingId: number, status: string, additionalData?: Partial<BookingUpdatePayload>) {
    await this.broadcastBookingUpdate(bookingId, {
      bookingId,
      status,
      ...additionalData,
    });
  }

  // Broadcast confirmed bookings update
  static async broadcastConfirmedBookingsUpdate(action: 'new' | 'assigned' | 'cancelled', bookingData: any) {
    if (this.confirmedBookingsSubscribers.size === 0) return;

    const message: RealtimeMessage = {
      type: 'confirmed_bookings_update',
      payload: {
        action,
        booking: bookingData,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
    };

    const messageStr = JSON.stringify(message);
    for (const userId of this.confirmedBookingsSubscribers) {
      const connections = this.userSubscriptions.get(userId);
      if (connections) {
        for (const ws of connections) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
          }
        }
      }
    }

    console.log(`[Realtime] Broadcasted confirmed bookings update (${action}) to ${this.confirmedBookingsSubscribers.size} subscribers`);
  }

  // Get connection statistics
  static getStats() {
    return {
      totalConnections: this.connections.size,
      activeSubscriptions: this.bookingSubscriptions.size,
      totalSubscriptions: Array.from(this.bookingSubscriptions.values())
        .reduce((sum, subs) => sum + subs.size, 0),
      confirmedBookingsSubscribers: this.confirmedBookingsSubscribers.size,
    };
  }
}

// Server-Sent Events fallback for browsers without WebSocket support
export class SSEManager {
  private static clients = new Map<string, { response: any; lastEventId: string }>();

  static addClient(userId: string, response: any) {
    this.clients.set(userId, { response, lastEventId: '' });

    // NOTE:
    // In the Next.js App Router implementation, headers are set in the
    // route handler (app/api/realtime/route.ts). Here we only keep a
    // minimal writer object (with write/end) and send SSE frames through it.

    // Send initial connection event
    this.sendToClient(userId, 'connected', { message: 'SSE connection established' });

    return userId;
  }

  static removeClient(userId: string) {
    this.clients.delete(userId);
  }

  static sendToClient(userId: string, event: string, data: any) {
    const client = this.clients.get(userId);
    if (client && client.response) {
      client.response.write(`event: ${event}\n`);
      client.response.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  static broadcast(event: string, data: any, excludeUserId?: string) {
    for (const [userId, client] of this.clients) {
      if (userId !== excludeUserId) {
        this.sendToClient(userId, event, data);
      }
    }
  }
}