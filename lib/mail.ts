import nodemailer from 'nodemailer';

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<{ sent: boolean; reason?: string }>{
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || '944 Trafik <trafik@944.dk>';

  // Try Resend first if API key is available
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'no-reply@944.dk',
          to: email,
          subject: 'Verify your email',
          html: `<p>Hej! Klik <a href="${verifyUrl}">her</a> for at bekræfte din e-mail.</p>`
        })
      });
      if (res.ok) {
        return { sent: true };
      }
      console.error('[resend error]', res.status, await res.text().catch(() => ''));
    } catch (error) {
      console.error('[resend error]', error);
    }
  }

  // Fallback to SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: email,
      subject: 'Verify your email',
      html: `<p>Hej! Klik <a href="${verifyUrl}">her</a> for at bekræfte din e-mail.</p>`
    });

    console.log('[smtp] Email sent:', info.messageId);
    return { sent: true };
  } catch (error) {
    console.error('[smtp error]', error);
    return { sent: false, reason: 'SMTP error' };
  }
}

export async function sendPaymentReminderEmail(
  email: string,
  invoiceNumber: string,
  dueDate: string,
  amount: number
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || '944 Trafik <trafik@944.dk>';

  const subject = `Payment Reminder - Invoice ${invoiceNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Payment Reminder</h2>
      <p>Dear Customer,</p>
      <p>This is a friendly reminder that your invoice <strong>${invoiceNumber}</strong> is due for payment.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</p>
        <p><strong>Amount Due:</strong> ${amount.toLocaleString('da-DK')} DKK</p>
      </div>

      <p>Please ensure payment is made before the due date to avoid any late fees.</p>
      <p>If you have already made the payment, please disregard this reminder.</p>

      <p>Best regards,<br>944 Trafik Team</p>
    </div>
  `;

  // Try Resend first if API key is available
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'no-reply@944.dk',
          to: email,
          subject,
          html
        })
      });
      if (res.ok) {
        return { sent: true };
      }
      console.error('[resend error]', res.status, await res.text().catch(() => ''));
    } catch (error) {
      console.error('[resend error]', error);
    }
  }

  // Fallback to SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: email,
      subject,
      html
    });

    console.log('[smtp] Payment reminder sent:', info.messageId);
    return { sent: true };
  } catch (error) {
    console.error('[smtp error]', error);
    return { sent: false, reason: 'SMTP error' };
  }
}

export async function sendLateFeeNotificationEmail(
  email: string,
  invoiceNumber: string,
  lateFeeAmount: number,
  newDueDate: string,
  totalAmount: number
): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL || '944 Trafik <trafik@944.dk>';

  const subject = `Late Fee Applied - Invoice ${invoiceNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Late Fee Notification</h2>
      <p>Dear Customer,</p>
      <p>We regret to inform you that due to the delay in payment for invoice <strong>${invoiceNumber}</strong>, a late fee has been applied.</p>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Late Fee Applied:</strong> ${lateFeeAmount.toLocaleString('da-DK')} DKK</p>
        <p><strong>New Due Date:</strong> ${new Date(newDueDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</p>
        <p><strong>Total Amount Due:</strong> ${totalAmount.toLocaleString('da-DK')} DKK</p>
      </div>

      <p>The late fee consists of 100 DKK plus 5.7% of the original invoice amount.</p>
      <p>Please make payment as soon as possible to avoid additional fees.</p>

      <p>If you believe this late fee was applied in error, please contact us immediately.</p>

      <p>Best regards,<br>944 Trafik Team</p>
    </div>
  `;

  // Try Resend first if API key is available
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'no-reply@944.dk',
          to: email,
          subject,
          html
        })
      });
      if (res.ok) {
        return { sent: true };
      }
      console.error('[resend error]', res.status, await res.text().catch(() => ''));
    } catch (error) {
      console.error('[resend error]', error);
    }
  }

  // Fallback to SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from,
      to: email,
      subject,
      html
    });

    console.log('[smtp] Late fee notification sent:', info.messageId);
    return { sent: true };
  } catch (error) {
    console.error('[smtp error]', error);
    return { sent: false, reason: 'SMTP error' };
  }
}
