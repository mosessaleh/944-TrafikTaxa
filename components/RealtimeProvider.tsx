'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { RealtimeMessage, BookingUpdatePayload, NotificationPayload, ChatMessagePayload } from '../lib/realtime';

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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [bookingUpdates, setBookingUpdates] = useState<BookingUpdatePayload[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const connectionIdRef = useRef<string | null>(null);

  const handleMessage = (message: RealtimeMessage) => {
    switch (message.type) {
      case 'booking_update':
        setBookingUpdates(prev => [...prev, message.payload as BookingUpdatePayload]);
        break;

      case 'notification':
        setNotifications(prev => [...prev, message.payload as NotificationPayload]);
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(message.payload.title, {
            body: message.payload.message,
            icon: '/logo.svg',
          });
        }
        break;

      case 'chat_message':
        setChatMessages(prev => [...prev, message.payload as ChatMessagePayload]);
        break;

      case 'pong':
        // Store connection ID if provided
        if (message.payload && message.payload.connectionId) {
          connectionIdRef.current = message.payload.connectionId;
        }
        break;

      default:
        console.log('[Realtime] Received message:', message);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        setIsAuthenticated(true);
        return true;
      } else {
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error('[Realtime] Error checking auth:', error);
      setIsAuthenticated(false);
      return false;
    }
  };

  const connect = async () => {
    if (esRef.current) return;

    // Check authentication first
    const authenticated = await checkAuth();
    if (!authenticated) {
      console.log('[Realtime] User not authenticated, skipping SSE connection');
      return;
    }

    try {
      const es = new EventSource('/api/realtime');
      esRef.current = es;

      es.addEventListener('connected', () => {
        console.log('[Realtime] SSE connected');
        setIsConnected(true);
      });

      es.addEventListener('message', (event) => {
        try {
          const data = (event as MessageEvent).data;
          const message: RealtimeMessage = JSON.parse(data);
          handleMessage(message);
          setIsConnected(true);
        } catch (error) {
          console.error('[Realtime] Error parsing SSE message:', error);
        }
      });

      es.onerror = async (error) => {
        console.error('[Realtime] SSE error:', error);
        setIsConnected(false);

        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }

        // Recheck authentication in case session expired
        await checkAuth();
      };
    } catch (error) {
      console.error('[Realtime] Failed to create SSE connection:', error);
    }
  };

  const subscribeToBooking = async (bookingId: number) => {
    if (!connectionIdRef.current) {
      console.warn('[Realtime] No connection ID available for subscription');
      return;
    }

    try {
      const response = await fetch('/api/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'subscribe',
          bookingId,
          connectionId: connectionIdRef.current
        })
      });

      if (!response.ok) {
        console.error('[Realtime] Failed to subscribe to booking:', response.statusText);
      }
    } catch (error) {
      console.error('[Realtime] Error subscribing to booking:', error);
    }
  };

  const unsubscribeFromBooking = async (bookingId: number) => {
    setBookingUpdates(prev => prev.filter(update => update.bookingId !== bookingId));
    setChatMessages(prev => prev.filter(msg => msg.bookingId !== bookingId));

    if (!connectionIdRef.current) {
      return;
    }

    try {
      const response = await fetch('/api/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unsubscribe',
          bookingId,
          connectionId: connectionIdRef.current
        })
      });

      if (!response.ok) {
        console.error('[Realtime] Failed to unsubscribe from booking:', response.statusText);
      }
    } catch (error) {
      console.error('[Realtime] Error unsubscribing from booking:', error);
    }
  };

  const sendChatMessage = (bookingId: number, message: string, toUserId: string) => {
    console.warn('[Realtime] sendChatMessage over SSE is not implemented yet', {
      bookingId,
      toUserId,
      message,
    });
    // TODO: Implement chat message sending via HTTP API
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Connect on mount and handle page visibility
  useEffect(() => {
    connect();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isConnected && !esRef.current && isAuthenticated) {
        await connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [isConnected, isAuthenticated]);

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
    <div suppressHydrationWarning>
      <RealtimeContext.Provider value={value}>
        {children}
      </RealtimeContext.Provider>
    </div>
  );
}