import * as Sentry from '@sentry/nextjs';

interface WAEvent {
  event: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export function trackBookingStarted(phone: string, lang: string) {
  Sentry.captureMessage(`[WA Analytics] booking_started`, {
    level: 'info',
    tags: { component: 'whatsapp-analytics', event_type: 'booking_started' },
    extra: { phone: phone.slice(-4), lang },
  });
}

export function trackBookingCreated(bookingId: number, phone: string, price: number, paymentMethod: string, lang: string) {
  Sentry.captureMessage(`[WA Analytics] booking_created #${bookingId}`, {
    level: 'info',
    tags: { component: 'whatsapp-analytics', event_type: 'booking_created' },
    extra: { bookingId, phone: phone.slice(-4), price, paymentMethod, lang },
  });
}

export function trackBookingFailed(reason: string, phone: string, lang: string) {
  Sentry.captureMessage(`[WA Analytics] booking_failed: ${reason}`, {
    level: 'warning',
    tags: { component: 'whatsapp-analytics', event_type: 'booking_failed' },
    extra: { reason, phone: phone.slice(-4), lang },
  });
}

export function trackRegistrationCompleted(userId: number, phone: string) {
  Sentry.captureMessage(`[WA Analytics] registration_completed #${userId}`, {
    level: 'info',
    tags: { component: 'whatsapp-analytics', event_type: 'registration_completed' },
    extra: { userId, phone: phone.slice(-4) },
  });
}

export function trackOpenAIUsed(model: string, inputTokens: number, outputTokens: number) {
  Sentry.captureMessage(`[WA Analytics] openai_used`, {
    level: 'info',
    tags: { component: 'whatsapp-analytics', event_type: 'openai_used' },
    extra: { model, inputTokens, outputTokens },
  });
}

export function trackConversationEnded(phone: string, durationSec: number, stage: string) {
  Sentry.captureMessage(`[WA Analytics] conversation_ended`, {
    level: 'info',
    tags: { component: 'whatsapp-analytics', event_type: 'conversation_ended' },
    extra: { phone: phone.slice(-4), durationSec, stage },
  });
}
