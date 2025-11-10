'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { RealtimeMessage, BookingUpdatePayload, NotificationPayload, ChatMessagePayload } from '@/lib/realtime';

interface RealtimeContextType {
  isConnected: boolean;
  subscribeToBooking: (bookingId: number) => void;
  unsubscribeFromBooking: (bookingId: number) => void;
  sendChatMessage: (bookingId: number, message: string, toUserId: string) => void;
  bookingUpdates: BookingUpdatePayload[];
  notifications: NotificationPayload[];
  chatMessages: ChatMessagePayload[];
  clearNotifications: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [bookingUpdates, setBookingUpdates] = useState<BookingUpdatePayload[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[Realtime] Connected to server');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('[Realtime] Error parsing message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('[Realtime] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`[Realtime] Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttempts.current); // Exponential backoff
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[Realtime] WebSocket error:', error);
      };

    } catch (error) {
      console.error('[Realtime] Failed to create WebSocket connection:', error);
    }
  };

  const handleMessage = (message: RealtimeMessage) => {
    switch (message.type) {
      case 'booking_update':
        setBookingUpdates(prev => [...prev, message.payload]);
        break;

      case 'notification':
        setNotifications(prev => [...prev, message.payload]);
        // Also show browser notification if permission granted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(message.payload.title, {
            body: message.payload.message,
            icon: '/logo.svg',
          });
        }
        break;

      case 'chat_message':
        setChatMessages(prev => [...prev, message.payload]);
        break;

      case 'pong':
        // Handle ping/pong for connection health
        break;

      default:
        console.log('[Realtime] Received message:', message);
    }
  };

  const subscribeToBooking = (bookingId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe_booking',
        payload: { bookingId },
        timestamp: Date.now(),
      }));
    }
  };

  const unsubscribeFromBooking = (bookingId: number) => {
    // WebSocket doesn't have explicit unsubscribe, just remove from local state
    setBookingUpdates(prev => prev.filter(update => update.bookingId !== bookingId));
    setChatMessages(prev => prev.filter(msg => msg.bookingId !== bookingId));
  };

  const sendChatMessage = (bookingId: number, message: string, toUserId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const chatPayload: ChatMessagePayload = {
        bookingId,
        fromUserId: 'current_user', // This should be set from auth context
        toUserId,
        message,
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        payload: chatPayload,
        timestamp: Date.now(),
      }));

      // Optimistically add to local state
      setChatMessages(prev => [...prev, chatPayload]);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Connect on mount and handle page visibility
  useEffect(() => {
    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  // Send periodic ping to keep connection alive
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          payload: {},
          timestamp: Date.now(),
        }));
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, []);

  const value: RealtimeContextType = {
    isConnected,
    subscribeToBooking,
    unsubscribeFromBooking,
    sendChatMessage,
    bookingUpdates,
    notifications,
    chatMessages,
    clearNotifications,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}