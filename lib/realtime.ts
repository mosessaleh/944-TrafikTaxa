import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

// Types for real-time communication
export interface RealtimeMessage {
  type: 'booking_update' | 'driver_location' | 'chat_message' | 'notification' | 'ping' | 'pong' | 'error' | 'subscribe_booking' | 'subscribe_confirmed_bookings' | 'confirmed_bookings_update' | 'ride_offer';
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

// Socket.IO-based real-time manager for ride assignment with timeout
export class RealtimeManager {
  private static confirmedBookingsSubscribers = new Set<string>();
  private static rideTimers = new Map<number, NodeJS.Timeout>(); // Timer for each ride offer
  private static currentRideOffers = new Map<number, { driverId: number, queueIndex: number, driverQueue: number[] }>(); // Track current offers

  // Broadcast confirmed bookings update - now uses sequential offering with timeout
  static async broadcastConfirmedBookingsUpdate(action: 'new' | 'assigned' | 'cancelled', bookingData: any) {
    if (action !== 'new') {
      // For assigned/cancelled, still broadcast to all for status updates
      this.broadcastToAllConfirmedBookingsSubscribers(action, bookingData);
      return;
    }

    // Check if booking meets the criteria for sending to drivers
    const meetsCriteria = bookingData.status === 'CONFIRMED' &&
                          bookingData.paymentMethod != null &&
                          bookingData.driverId == null &&
                          bookingData.car == null;

    console.log(`[Realtime] Checking booking ${bookingData.id} for dispatch criteria: status=${bookingData.status}, paymentMethod=${bookingData.paymentMethod}, driverId=${bookingData.driverId}, car=${bookingData.car}, meetsCriteria=${meetsCriteria}`);

    if (!meetsCriteria) {
      console.log(`[Realtime] Booking ${bookingData.id} does not meet criteria for driver dispatch, skipping`);
      return;
    }

    // Get driver queue from booking data
    const driverQueue = Array.isArray(bookingData.driverQueue) ? bookingData.driverQueue : [];
    if (driverQueue.length === 0) {
      console.log(`[Realtime] No drivers in queue for booking ${bookingData.id}, skipping`);
      return;
    }

    // Start offering to first driver in queue
    const firstDriverId = driverQueue[0];
    console.log(`[Realtime] Starting sequential ride offering for booking ${bookingData.id} to driver queue: ${driverQueue.join(', ')}`);

    await this.startRideAcceptanceTimer(bookingData.id, firstDriverId, driverQueue, 0);
  }

  // Broadcast to all confirmed bookings subscribers (for status updates)
  private static broadcastToAllConfirmedBookingsSubscribers(action: string, bookingData: any) {
    if ((global as any).io) {
      (global as any).io.emit('confirmedBookingsUpdate', {
        action,
        booking: bookingData,
        timestamp: Date.now()
      });
      console.log(`[Realtime] Broadcasted confirmed bookings update (${action}) to all subscribers via Socket.IO`);
    }
  }

  // Start ride acceptance timer for a specific driver
  static async startRideAcceptanceTimer(rideId: number, driverId: number, driverQueue: number[], queueIndex: number = 0) {
    console.log(`[Realtime] Starting 30-second acceptance timer for ride ${rideId} with driver ${driverId} (queue position ${queueIndex})`);

    // Clear any existing timer for this ride
    this.clearRideTimer(rideId);

    // Track current offer
    this.currentRideOffers.set(rideId, { driverId, queueIndex, driverQueue });

    // Set currentRideId and rideAccepted = 0 for the driver
    await prisma.comDriver.update({
      where: { id: driverId },
      data: { currentRideId: rideId, rideAccepted: 0 }
    });

    // Send ride offer to this specific driver
    this.sendRideOfferToDriver(rideId, driverId);

    // Start timer with periodic checks every 2 seconds
    const timer = setInterval(async () => {
      try {
        const driver = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: { rideAccepted: true, currentRideId: true }
        });

        if (driver?.rideAccepted === 1 && driver.currentRideId === rideId) {
          // Driver accepted the ride
          console.log(`[Realtime] Driver ${driverId} accepted ride ${rideId}`);
          this.clearRideTimer(rideId);
          return;
        }
      } catch (error) {
        console.error(`[Realtime] Error checking acceptance for ride ${rideId}:`, error);
      }
    }, 2000); // Check every 2 seconds

    this.rideTimers.set(rideId, timer);

    // Set 30-second timeout
    setTimeout(async () => {
      try {
        // Clear the interval timer
        this.clearRideTimer(rideId);

        // Final check for acceptance
        const driver = await prisma.comDriver.findUnique({
          where: { id: driverId },
          select: { rideAccepted: true, currentRideId: true }
        });

        if (driver?.rideAccepted === 1 && driver.currentRideId === rideId) {
          // Driver accepted within the last check
          console.log(`[Realtime] Driver ${driverId} accepted ride ${rideId} (final check)`);
          return;
        }

        // Driver did not accept - apply penalty
        console.log(`[Realtime] Driver ${driverId} did not accept ride ${rideId} within 30 seconds - applying penalty`);

        await prisma.comDriver.update({
          where: { id: driverId },
          data: {
            currentRideId: null,
            isBusy: true, // Penalty: mark as busy
            rideAccepted: 0
          }
        });

        // Send penalty notification
        this.sendPenaltyNotification(driverId);

        // Try next driver in queue
        this.offerToNextDriver(rideId, driverQueue, queueIndex);

      } catch (error) {
        console.error(`[Realtime] Error in timeout handler for ride ${rideId}:`, error);
      }
    }, 30000); // 30 seconds
  }

  // Send ride offer to specific driver using Socket.IO
  private static sendRideOfferToDriver(rideId: number, driverId: number) {
    if ((global as any).io) {
      (global as any).io.to(`driver_${driverId}`).emit('rideOffer', {
        rideId: rideId,
        timestamp: Date.now()
      });
      console.log(`[Realtime] Sent ride offer for ${rideId} to driver ${driverId} via Socket.IO`);
    } else {
      console.error('[Realtime] Socket.IO not available');
    }
  }

  // Send penalty notification to driver
  private static sendPenaltyNotification(driverId: number) {
    if ((global as any).io) {
      (global as any).io.to(`driver_${driverId}`).emit('notification', {
        id: `penalty_${Date.now()}`,
        type: 'warning',
        title: 'Penalty Applied',
        message: 'You did not accept the ride offer within 30 seconds. You are now marked as busy.',
        timestamp: Date.now()
      });
    }
  }

  // Offer ride to next driver in queue
  private static offerToNextDriver(rideId: number, driverQueue: number[], currentIndex: number) {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= driverQueue.length) {
      console.log(`[Realtime] No more drivers in queue for ride ${rideId}`);
      // Could implement fallback logic here (broadcast to all, etc.)
      return;
    }

    const nextDriverId = driverQueue[nextIndex];
    console.log(`[Realtime] Offering ride ${rideId} to next driver ${nextDriverId} (position ${nextIndex})`);

    this.startRideAcceptanceTimer(rideId, nextDriverId, driverQueue, nextIndex);
  }

  // Clear timer for a ride
  private static clearRideTimer(rideId: number) {
    const timer = this.rideTimers.get(rideId);
    if (timer) {
      clearInterval(timer);
      this.rideTimers.delete(rideId);
    }
    this.currentRideOffers.delete(rideId);
  }

  // Get connection statistics
  static getStats() {
    return {
      confirmedBookingsSubscribers: this.confirmedBookingsSubscribers.size,
      activeRideTimers: this.rideTimers.size,
      currentRideOffers: this.currentRideOffers.size,
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