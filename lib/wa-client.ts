import { logWAError, logWAWarning } from '@/lib/wa-logger';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';
const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

const WA_RATE_LIMIT = parseInt(process.env.WHATSAPP_RATE_LIMIT || '50', 10);
const WA_BURST = WA_RATE_LIMIT * 2;
const WA_QUEUE_MAX = parseInt(process.env.WHATSAPP_QUEUE_MAX || '2000', 10);
const WA_QUEUE_TIMEOUT_MS = parseInt(process.env.WHATSAPP_QUEUE_TIMEOUT || '30000', 10);

type QueueItem = { send: () => Promise<boolean>; resolve: (ok: boolean) => void; enqueuedAt: number };

const waQueue: QueueItem[] = [];
let waQueueProcessing = false;
let waTokens = WA_RATE_LIMIT;
let waInterval: ReturnType<typeof setInterval> | null = null;

function ensureWaInterval() {
  if (waInterval) return;
  waInterval = setInterval(() => {
    waTokens = Math.min(waTokens + WA_RATE_LIMIT, WA_BURST);
    processWaQueue();
  }, 1000);
}

async function processWaQueue() {
  if (waQueueProcessing) return;
  waQueueProcessing = true;
  const now = Date.now();
  while (waQueue.length > 0) {
    const expired = waQueue.findIndex(item => now - item.enqueuedAt > WA_QUEUE_TIMEOUT_MS);
    if (expired >= 0) {
      const removed = waQueue.splice(expired, 1);
      removed.forEach(item => item.resolve(false));
      continue;
    }
    if (waTokens <= 0) break;
    const item = waQueue.shift()!;
    waTokens--;
    try {
      const ok = await item.send();
      item.resolve(ok);
    } catch {
      item.resolve(false);
    }
  }
  waQueueProcessing = false;
}

function enqueueWa(send: () => Promise<boolean>): Promise<boolean> {
  if (waQueue.length >= WA_QUEUE_MAX) return Promise.resolve(false);
  ensureWaInterval();
  return new Promise<boolean>(resolve => {
    waQueue.push({ send, resolve, enqueuedAt: Date.now() });
    processWaQueue();
  });
}

function isValidPhone(to: string): boolean {
  return PHONE_REGEX.test(to.trim());
}

function validatePhone(to: string): string {
  const sanitized = to.trim().replace(/[\s\-()]/g, '');
  if (!isValidPhone(sanitized)) {
    logWAWarning('invalid_phone', { phone: to });
    return '';
  }
  return sanitized;
}

let cachedPhoneId = '';
let cachedToken = '';
let _prisma: any = null;

function getPrisma() {
  if (!_prisma) {
    import('@/lib/db').then(m => { _prisma = m.prisma; }).catch(() => {});
  }
}

function logMessage(params: {
  phone: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'template' | 'interactive' | 'notification';
  content: string;
  status: 'sent' | 'failed';
  userId?: number;
  rideId?: number;
  errorMessage?: string;
}) {
  getPrisma();
  if (!_prisma) return;
  (_prisma as any).whatsAppMessage.create({
    data: {
      phone: params.phone,
      direction: params.direction,
      type: params.type,
      content: params.content,
      status: params.status,
      userId: params.userId || null,
      rideId: params.rideId || null,
      errorMessage: params.errorMessage || null,
    },
  }).catch(() => {});
}

function getWACreds() {
  if (!cachedPhoneId) {
    cachedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    cachedToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  }
  return { phoneId: cachedPhoneId, token: cachedToken };
}

const RETRY_MAX = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

async function waFetch(endpoint: string, body: Record<string, unknown>): Promise<boolean> {
  const { phoneId, token } = getWACreds();
  if (!phoneId || !token) return false;

  for (let attempt = 0; attempt < RETRY_MAX; attempt++) {
    try {
      const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) return true;

      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        logWAError(`client_error_${res.status}`, new Error(await res.text().catch(() => '')), { endpoint });
        return false;
      }

      if (attempt < RETRY_MAX - 1) {
        logWAWarning(`retry_${res.status}`, { endpoint, attempt: attempt + 1, max: RETRY_MAX - 1 });
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      } else {
        logWAError('all_retries_failed', new Error(`Status ${res.status}`), { endpoint });
      }
    } catch (e) {
      if (attempt < RETRY_MAX - 1) {
        logWAWarning('network_retry', { endpoint, attempt: attempt + 1, max: RETRY_MAX - 1 });
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      } else {
        logWAError('network_all_retries_failed', e, { endpoint });
      }
    }
  }

  return false;
}

export async function sendWAText(to: string, text: string, skipQueue = false): Promise<boolean> {
  const phone = validatePhone(to);
  if (!phone) return false;
  const send = async () => {
    const ok = await waFetch('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: text },
    });
    logMessage({ phone: phone, direction: 'outbound', type: 'text', content: text, status: ok ? 'sent' : 'failed', errorMessage: ok ? undefined : 'send failed' });
    return ok;
  };
  return skipQueue ? send() : enqueueWa(send);
}

export async function sendWAButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  footerText?: string,
): Promise<boolean> {
  const phone = validatePhone(to);
  if (!phone) return false;
  const { phoneId } = getWACreds();

  if (!phoneId) {
    const btnList = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    return sendWAText(phone, `${bodyText}\n\n${btnList}${footerText ? '\n' + footerText : ''}`);
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: bodyText },
    action: { buttons: buttons.map(b => ({ type: 'reply', reply: { id: b.id, title: b.title.substring(0, 20) } })) },
  };
  if (footerText) interactive.footer = { text: footerText };

  return waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive,
  });
}

export async function sendWAList(
  to: string,
  bodyText: string,
  sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[],
  buttonText?: string,
): Promise<boolean> {
  const phone = validatePhone(to);
  if (!phone) return false;
  const { phoneId } = getWACreds();

  if (!phoneId) {
    const rows = sections.flatMap(s => s.rows.map(r => `- ${r.title}`));
    return sendWAText(phone, `${bodyText}\n\n${rows.join('\n')}`);
  }

  return waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonText || 'Select',
        sections: sections.map(s => ({
          title: s.title,
          rows: s.rows.map(r => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })),
        })),
      },
    },
  });
}

export async function sendWATemplate(
  to: string,
  templateName: string,
  languageCode: string,
  parameters: string[],
  skipQueue = false,
): Promise<boolean> {
  const phone = validatePhone(to);
  if (!phone) return false;
  const send = async () => {
    const ok = await waFetch('messages', {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: 'body',
            parameters: parameters.map(text => ({ type: 'text', text })),
          },
        ],
      },
    });
    logMessage({ phone: phone, direction: 'outbound', type: 'template', content: `[${templateName}] ${parameters.join(' | ')}`, status: ok ? 'sent' : 'failed' });
    return ok;
  };
  return skipQueue ? send() : enqueueWa(send);
}

const MESSAGE_RETENTION_DAYS = parseInt(process.env.WA_MESSAGE_RETENTION_DAYS || '90', 10);
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startMessageCleanup(): void {
  if (MESSAGE_RETENTION_DAYS <= 0) return;

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const prismaModule = await import('@/lib/db');
      const result = await (prismaModule.prisma as any).whatsAppMessage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        console.log(`[WA cleanup] Deleted ${result.count} old WhatsAppMessage records (older than ${MESSAGE_RETENTION_DAYS}d)`);
      }
    } catch (e) {
    }
  }, CLEANUP_INTERVAL_MS);
}

startMessageCleanup();
