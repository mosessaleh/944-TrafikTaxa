import { prisma } from './db';
import {
  notifyUserBookingConfirmation,
  notifyUserPaymentReceived,
  notifyUserInvoiceReady,
} from './notify';
import { Expo, ExpoPushMessage, ExpoPushToken } from 'expo-server-sdk';

const prismaAny = prisma as any;

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
  sendRealtime?: boolean;
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
 * - يرسل Realtime notification
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
 * - يرسل Realtime notification
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
 * - يرسل Realtime notification
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
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});
console.log('Expo client initialized with access token:', process.env.EXPO_ACCESS_TOKEN ? 'set' : 'not set');

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
) {
  console.log('sendPushNotification called with token:', pushToken.substring(0, 10) + '...', 'title:', title);
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
    channelId: 'batch',
    priority: 'high',
  };

  console.log('Sending push notification with message:', message);

  try {
    console.log('Sending push notification to Expo server...');
    const ticket = await expo.sendPushNotificationsAsync([message]);
    console.log('Push notification sent to Expo, ticket:', ticket);
    if (ticket[0].status === 'ok') {
      console.log('Push notification accepted by Expo');
    } else {
      console.log('Push notification rejected by Expo, details:', ticket[0]);
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
    await sendPushNotification(user.pushToken, title, body, data);
  }
}

export async function sendPushToDriver(
  driverId: number,
  title: string,
  body: string,
  data?: any
) {
  console.log('sendPushToDriver called for driverId:', driverId, 'title:', title, 'body:', body);
  const driver = await prismaAny.comDriver.findUnique({
    where: { id: driverId },
    select: { expoPushToken: true },
  });

  console.log('Driver found:', driver ? 'yes' : 'no', 'pushToken:', driver?.expoPushToken ? 'exists' : 'null');
  if (driver?.expoPushToken) {
    console.log('Sending push notification to driverId:', driverId, 'with token:', driver.expoPushToken.substring(0, 20) + '...');
    await sendPushNotification(driver.expoPushToken, title, body, data);
    console.log('Push notification sent successfully to driverId:', driverId);
  } else {
    console.log('No push token for driverId:', driverId, '- cannot send notification');
  }
}
