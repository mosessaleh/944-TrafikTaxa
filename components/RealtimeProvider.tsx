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
  const esRef = useRef<EventSource | null>(null);

  const handleMessage = (message: RealtimeMessage) => {
    switch (message.type) {
      case 'booking_update':
        setBookingUpdates(prev => [...prev, message.payload as BookingUpdatePayload]);
        break;

      case 'notification':
        setNotifications(prev => [...prev, message.payload as NotificationPayload]);
        if ('Notification' in window && Notification.permission === 'granted') {
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
        // No-op for SSE
        break;

      default:
        console.log('[Realtime] Received message:', message);
    }
  };

  const connect = () => {
    if (esRef.current) return;

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

      es.onerror = (error) => {
        console.error('[Realtime] SSE error:', error);
        setIsConnected(false);

        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
        }
      };
    } catch (error) {
      console.error('[Realtime] Failed to create SSE connection:', error);
    }
  };

  const subscribeToBooking = (bookingId: number) => {
    console.warn('[Realtime] subscribeToBooking over SSE is not implemented yet', bookingId);
  };

  const unsubscribeFromBooking = (bookingId: number) => {
    setBookingUpdates(prev => prev.filter(update => update.bookingId !== bookingId));
    setChatMessages(prev => prev.filter(msg => msg.bookingId !== bookingId));
  };

  const sendChatMessage = (bookingId: number, message: string, toUserId: string) => {
    console.warn('[Realtime] sendChatMessage over SSE is not implemented yet', {
      bookingId,
      toUserId,
      message,
    });
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
      if (document.visibilityState === 'visible' && !isConnected && !esRef.current) {
        connect();
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
  }, [isConnected]);

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