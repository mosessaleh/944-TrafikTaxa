import { logWAError, logWAWarning } from '@/lib/wa-logger';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';

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

export async function sendWAText(to: string, text: string): Promise<boolean> {
  const ok = await waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
  logMessage({ phone: to, direction: 'outbound', type: 'text', content: text, status: ok ? 'sent' : 'failed', errorMessage: ok ? undefined : 'send failed' });
  return ok;
}

export async function sendWAButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
  footerText?: string,
): Promise<boolean> {
  const { phoneId } = getWACreds();

  if (!phoneId) {
    const btnList = buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    return sendWAText(to, `${bodyText}\n\n${btnList}${footerText ? '\n' + footerText : ''}`);
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
    to,
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
  const { phoneId } = getWACreds();

  if (!phoneId) {
    const rows = sections.flatMap(s => s.rows.map(r => `- ${r.title}`));
    return sendWAText(to, `${bodyText}\n\n${rows.join('\n')}`);
  }

  return waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
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
): Promise<boolean> {
  const ok = await waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
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
  logMessage({ phone: to, direction: 'outbound', type: 'template', content: `[${templateName}] ${parameters.join(' | ')}`, status: ok ? 'sent' : 'failed' });
  return ok;
}
