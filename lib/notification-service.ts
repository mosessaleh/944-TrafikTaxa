import { prisma } from './db';
import {
  notifyUserBookingConfirmation,
  notifyUserPaymentReceived,
  notifyUserInvoiceReady,
} from './notify';
import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';

const prismaAny = prisma as any;
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

const DRIVER_PUSH_CHANNEL_ID = 'driver-rides';
const USER_PUSH_CHANNEL_ID = 'user-updates';

const EXPO_RECEIPT_PROCESS_DELAY_MS = 15000;
const EXPO_RECEIPT_CHUNK_DELAY_MS = 250;

function normalizeExpoToken(rawToken: unknown): string | null {
  if (typeof rawToken !== 'string') return null;
  const token = rawToken.trim();
  if (!token) return null;
  return Expo.isExpoPushToken(token) ? token : null;
}

async function clearInvalidPushToken(pushToken: string) {
  try {
    await prismaAny.user.updateMany({
      where: { pushToken },
      data: { pushToken: null },
    });
  } catch (error) {
    console.error('Failed to clear invalid user push token:', error);
  }

  try {
    await prismaAny.comDriver.updateMany({
      where: { expoPushToken: pushToken },
      data: { expoPushToken: null },
    });
  } catch (error) {
    console.error('Failed to clear invalid driver push token:', error);
  }
}

async function processExpoReceipts(receiptIds: string[], receiptTokenMap?: Map<string, string>) {
  if (!receiptIds.length) return;

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
  for (const receiptIdChunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(receiptIdChunk);

      for (const receiptId of Object.keys(receipts)) {
        const receipt = receipts[receiptId] as ExpoPushReceipt;
        if (receipt?.status === 'ok') continue;

        const errorCode = (receipt?.details as any)?.error;
        if (!errorCode) continue;

        if (errorCode === 'DeviceNotRegistered') {
          const token =
            (receipt?.details as any)?.expoPushToken ||
            (receipt as any)?.to ||
            (receiptTokenMap ? receiptTokenMap.get(receiptId) : null);
          if (typeof token === 'string' && token.trim()) {
            await clearInvalidPushToken(token.trim());
          }
        }
      }
    } catch (error) {
      console.error('Error processing Expo push receipts:', error);
    }

    await new Promise((resolve) => setTimeout(resolve, EXPO_RECEIPT_CHUNK_DELAY_MS));
  }
}

function collectInvalidTokenFromTicket(ticket: ExpoPushTicket): string | null {
  if (ticket?.status !== 'error') return null;
  const details = (ticket as any)?.details;
  if (!details || details.error !== 'DeviceNotRegistered') return null;
  const token = details.expoPushToken || (ticket as any)?.to;
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

type NotificationKind = 'booking' | 'payment' | 'invoice';

export async function ensureNotificationSettings(userId: number) {
  await prismaAny.notificationSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function shouldSendEmail(userId: number, kind: NotificationKind): Promise<boolean> {
  const settings = await prismaAny.notificationSettings.findUnique({ where: { userId } });
  if (!settings) return true; // fallback: إذا ما في إعدادات، نرسل الإيميل

  switch (kind) {
    case 'booking':
      return settings.emailBooking;
    case 'payment':
      return settings.emailPayment;
    case 'invoice':
      return settings.emailInvoice;
    default:
      return true;
  }
}

export async function createNotification(userId: number, params: {
  type: string;
  title: string;
  body: string;
  data?: any;
}) {
  const { type, title, body, data } = params;

  const notification = await prismaAny.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ?? {},
    },
  });

  return notification;
}

/**
 * إشعار موحّد لتأكيد الحجز:
 * - يسجّل Notification في قاعدة البيانات
 * - يرسل إيميل تأكيد حجز لو تفضيلات المستخدم تسمح
 */
export async function notifyBookingConfirmedUnified(
  user: { id: number; email: string; firstName: string },
  bookingDetails: any
) {
  await ensureNotificationSettings(user.id);

  const pickupTime = bookingDetails.pickupTime
    ? new Date(bookingDetails.pickupTime).toLocaleString('en-DK')
    : '';

  await createNotification(user.id, {
    type: 'booking_confirmed',
    title: 'Your booking is confirmed',
    body: `Your ride #${bookingDetails.id} on ${pickupTime} is confirmed.`,
    data: {
      bookingId: bookingDetails.id,
      actionUrl: `/bookings/${bookingDetails.id}`,
    },
  });

  // Send push notification
  await sendPushToUser(user.id, 'Booking Confirmed', `Your ride #${bookingDetails.id} is confirmed.`, {
    bookingId: bookingDetails.id,
  });

  if (await shouldSendEmail(user.id, 'booking')) {
    await notifyUserBookingConfirmation(user.email, user.firstName, bookingDetails);
  }
}

/**
 * إشعار موحّد لاستلام الدفع:
 * - يسجّل Notification
 * - يرسل إيميل "Payment Received" لو مسموح
 */
export async function notifyPaymentReceivedUnified(
  user: { id: number; email: string; firstName: string },
  paymentDetails: {
    amount: number;
    method: string;
    transactionId: string;
    bookingId?: number | string | null;
    invoiceId?: number | string | null;
  }
) {
  await ensureNotificationSettings(user.id);

  const bookingId = paymentDetails.bookingId
    ? Number(paymentDetails.bookingId)
    : undefined;

  await createNotification(user.id, {
    type: 'payment_received',
    title: 'Payment received',
    body: `We have received your payment of ${paymentDetails.amount} DKK via ${paymentDetails.method}.`,
    data: {
      bookingId: bookingId,
      invoiceId: paymentDetails.invoiceId,
      actionUrl: bookingId ? `/bookings/${bookingId}` : '/bookings',
    },
  });

  if (await shouldSendEmail(user.id, 'payment')) {
    await notifyUserPaymentReceived(user.email, user.firstName, paymentDetails);
  }
}

/**
 * إشعار موحّد لجهوزية الفاتورة:
 * - يسجّل Notification
 * - يرسل إيميل "Invoice Ready" لو مسموح
 */
export async function notifyInvoiceReadyUnified(
  user: { id: number; email: string; firstName: string },
  invoiceDetails: { bookingId: number; price: number },
  invoiceId?: number
) {
  await ensureNotificationSettings(user.id);

  await createNotification(user.id, {
    type: 'invoice_ready',
    title: 'Your invoice is ready',
    body: `Your invoice for booking #${invoiceDetails.bookingId} (${invoiceDetails.price} DKK) is ready.`,
    data: {
      bookingId: invoiceDetails.bookingId,
      invoiceId,
      actionUrl: `/invoices/${invoiceId ?? invoiceDetails.bookingId}`,
    },
  });

  if (await shouldSendEmail(user.id, 'invoice')) {
    await notifyUserInvoiceReady(user.email, user.firstName, invoiceDetails, invoiceId);
  }
}

// Push Notification Functions
console.log('Expo client initialized with access token:', process.env.EXPO_ACCESS_TOKEN ? 'set' : 'not set');

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any,
  options?: { channelId?: string }
) {
  const normalizedToken = normalizeExpoToken(pushToken);
  if (!normalizedToken) {
    console.error('Invalid Expo push token');
    return;
  }

  const message: ExpoPushMessage = {
    to: normalizedToken,
    sound: 'default',
    title,
    body,
    data: data || {},
    channelId: options?.channelId || USER_PUSH_CHANNEL_ID,
    priority: 'high',
  };

  try {
    const tickets = await expo.sendPushNotificationsAsync([message]);
    const receiptIds: string[] = [];
    const receiptTokenMap = new Map<string, string>();

    for (const ticket of tickets) {
      if (ticket?.status === 'ok' && ticket.id) {
        receiptIds.push(ticket.id);
        receiptTokenMap.set(ticket.id, normalizedToken);
        continue;
      }

      const invalidToken = collectInvalidTokenFromTicket(ticket as ExpoPushTicket);
      if (invalidToken) {
        await clearInvalidPushToken(invalidToken);
      } else {
        console.warn('Push notification rejected by Expo:', ticket);
      }
    }

    if (receiptIds.length > 0) {
      setTimeout(() => {
        processExpoReceipts(receiptIds, receiptTokenMap).catch((error) => {
          console.error('Failed processing Expo receipts:', error);
        });
      }, EXPO_RECEIPT_PROCESS_DELAY_MS);
    }
  } catch (error) {
    console.error('Error sending push notification to Expo:', error);
  }
}

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: any
) {
  const user = await prismaAny.user.findUnique({
    where: { id: userId },
    select: { pushToken: true },
  });

  if (user?.pushToken) {
    await sendPushNotification(user.pushToken, title, body, data, {
      channelId: USER_PUSH_CHANNEL_ID,
    });
  }
}

export async function sendPushToDriver(
  driverId: number,
  title: string,
  body: string,
  data?: any
) {
  const driver = await prismaAny.comDriver.findUnique({
    where: { id: driverId },
    select: { expoPushToken: true },
  });

  if (driver?.expoPushToken) {
    await sendPushNotification(driver.expoPushToken, title, body, data, {
      channelId: DRIVER_PUSH_CHANNEL_ID,
    });
  }
}
