const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v22.0';

let cachedPhoneId = '';
let cachedToken = '';

function getWACreds() {
  if (!cachedPhoneId) {
    cachedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    cachedToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  }
  return { phoneId: cachedPhoneId, token: cachedToken };
}

async function waFetch(endpoint: string, body: Record<string, unknown>): Promise<boolean> {
  const { phoneId, token } = getWACreds();
  if (!phoneId || !token) return false;

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${phoneId}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[WA Client] ${endpoint} failed:`, res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[WA Client] ${endpoint} error:`, e);
    return false;
  }
}

export async function sendWAText(to: string, text: string): Promise<boolean> {
  return waFetch('messages', {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
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
