export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<{ sent: boolean; reason?: string }>{
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'no-reply@944.dk';
  if (!key) {
    console.log('[dev-mail] To:', email, 'Verify:', verifyUrl);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: email, subject: 'Verify your email', html: `<p>Hej! Klik <a href="${verifyUrl}">her</a> for at bekræfte din e-mail.</p>` })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[resend error]', res.status, text);
    return { sent: false, reason: `Resend error ${res.status}` };
  }
  return { sent: true };
}
