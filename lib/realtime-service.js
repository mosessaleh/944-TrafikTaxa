const { RealtimeMessage, BookingUpdatePayload, NotificationPayload, ChatMessagePayload } = require('./realtime');

class RealtimeService {
  constructor() {
    this.connections = new Map();
  }

  addConnection(connectionId, controller, userId) {
    this.connections.set(connectionId, {
      controller,
      userId,
      subscribedBookings: new Set()
    });
  }

  removeConnection(connectionId) {
    this.connections.delete(connectionId);
  }

  subscribeToBooking(connectionId, bookingId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscribedBookings.add(bookingId);
    }
  }

  unsubscribeFromBooking(connectionId, bookingId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.subscribedBookings.delete(bookingId);
    }
  }

  sendToUser(userId, message) {
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.userId === userId) {
        try {
          const encoder = new TextEncoder();
          connection.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch (error) {
          console.error('Error sending SSE message:', error);
          this.removeConnection(connectionId);
        }
      }
    }
  }

  sendBookingUpdate(bookingId, payload) {
    const message = {
      type: 'booking_update',
      payload
    };

    // Send to all connections subscribed to this booking
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.subscribedBookings.has(bookingId)) {
        try {
          const encoder = new TextEncoder();
          connection.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch (error) {
          console.error('Error sending booking update SSE message:', error);
          this.removeConnection(connectionId);
        }
      }
    }
  }

  sendNotification(userId, payload) {
    const message = {
      type: 'notification',
      payload
    };
    this.sendToUser(userId, message);
  }

  sendChatMessage(bookingId, payload) {
    const message = {
      type: 'chat_message',
      payload
    };

    // Send to all connections subscribed to this booking
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.subscribedBookings.has(bookingId)) {
        try {
          const encoder = new TextEncoder();
          connection.controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
        } catch (error) {
          console.error('Error sending chat message SSE:', error);
          this.removeConnection(connectionId);
        }
      }
    }
  }
}

const realtimeService = new RealtimeService();
module.exports = realtimeService;