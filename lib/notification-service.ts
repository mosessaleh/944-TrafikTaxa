import { prisma } from '@/lib/db';
import {
  notifyUserBookingConfirmation,
  notifyUserPaymentReceived,
  notifyUserInvoiceReady,
} from '@/lib/notify';

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