export interface RealtimeMessage {
  type: 'booking_update' | 'notification' | 'chat_message' | 'pong';
  payload: any;
}

export interface BookingUpdatePayload {
  bookingId: number;
  status: string;
  driverId?: number;
  driver?: any;
  driverName?: string | null;
  driverPhone?: string | null;
  eta?: number | null | {
    timeMinutes?: number | null;
    distanceKm?: number | null;
  };
  location?: {
    lat: number;
    lng: number;
  } | null;
  timestamp: string;
}

export interface NotificationPayload {
  title: string;
  message: string;
  type?: string;
}

export interface ChatMessagePayload {
  bookingId: number;
  message: string;
  sender?: string;
  id?: string | number;
  messageId?: string | number;
  fromUserId?: string | number;
  timestamp?: string | number;
}
