import nodemailer from 'nodemailer';

type SendResult = { ok: true } | { ok: false; error: string; detail?: string };

async function trySend(opts: { host:string; port:number; user:string; pass:string; from:string; to:string; subject:string; html:string; secure:boolean; requireTLS?:boolean }): Promise<SendResult> {
  const { host, port, user, pass, from, to, subject, html, secure, requireTLS } = opts;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,                 // 465=true, 587=false
    auth: { user, pass },
    requireTLS: requireTLS ?? false,
    logger: true            // يطبع تفاصيل في السيرفر
  }, { from });

  try {
    await transporter.verify();
  } catch (e: any) {
    console.error('[MAIL] verify failed', { host, port, secure, requireTLS, code: e?.code, msg: e?.message });
    return { ok:false, error:'VERIFY_FAIL', detail: e?.message };
  }

  try {
    const info = await transporter.sendMail({ to, subject, html });
    console.log('[MAIL] sent', { messageId: info.messageId, host, port });
    return { ok:true };
  } catch (e: any) {
    console.error('[MAIL] send failed', { host, port, code: e?.code, msg: e?.message });
    return { ok:false, error: e?.code || 'SEND_FAIL', detail: e?.message };
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const host = process.env.SMTP_HOST || '';
  const port = Number(process.env.SMTP_PORT || '465');
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  // اجعل FROM يطابق المستخدم إن لم يكن Alias مصرح به
  const envFrom = process.env.SMTP_FROM || user;
  const from = envFrom.includes('@') ? envFrom : user;

  // المحاولة الأولى: حسب الإعدادات (465→secure=true أو 587→secure=false)
  const primary: SendResult = await trySend({
    host, port, user, pass, from, to, subject, html,
    secure: port === 465,
    requireTLS: port === 587
  });
  if (primary.ok) return primary;

  // إن فشل بسبب TLS/اتصال، جرّب تلقائياً 587/STARTTLS
  if (port === 465) {
    console.warn('[MAIL] primary failed on 465, retrying on 587/STARTTLS');
    const fallback = await trySend({
      host, port: 587, user, pass, from, to, subject, html,
      secure: false, requireTLS: true
    });
    return fallback;
  }

  return primary;
}
