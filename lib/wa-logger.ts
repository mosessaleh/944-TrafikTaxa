import * as Sentry from '@sentry/nextjs';

export function logWAEvent(event: string, data?: Record<string, unknown>) {
  console.log(`[WhatsApp] ${event}`, data || '');
  Sentry.captureMessage(`[WhatsApp] ${event}`, {
    level: 'info',
    tags: { component: 'whatsapp' },
    extra: data,
  });
}

export function logWAError(event: string, error: Error | unknown, data?: Record<string, unknown>) {
  console.error(`[WhatsApp] ${event}`, error, data || '');
  const safeData = data ? { ...data } : undefined;
  if (safeData) {
    delete safeData.phone;
    delete safeData.email;
    delete safeData.address;
    delete safeData.fullName;
  }
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    tags: { component: 'whatsapp', event },
    extra: safeData,
  });
}

export function logWAWarning(event: string, data?: Record<string, unknown>) {
  console.warn(`[WhatsApp] ${event}`, data || '');
  Sentry.captureMessage(`[WhatsApp] ${event}`, {
    level: 'warning',
    tags: { component: 'whatsapp' },
    extra: data,
  });
}
