import nodemailer from "nodemailer";
import { limitOrThrow } from "./rate-limit";

export async function sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || user;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    console.error("[email] Invalid email format:", to);
    return { ok: false, reason: "invalid_email_format" };
  }

  // Rate limiting: 10 emails per hour per email address
  const emailKey = `email:${to.toLowerCase()}`;

  try {
    await limitOrThrow(emailKey, { points: 10, durationSec: 3600 }); // 10 emails per hour
  } catch (error: any) {
    if (error.status === 429) {
      console.warn(`[email] Rate limit exceeded for ${to}`);
      return { ok: false, reason: "rate_limit_exceeded" };
    }
  }

  if (!host || !user || !pass || !from) {
    console.warn("[email] SMTP not configured. Printing email to console instead.");
    console.log({ to, subject, html });
    return { ok: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({ from, to, subject, html, attachments });
    console.log(`[email] Successfully sent email to ${to}: ${subject}`);
    return { ok: true };
  } catch (error: any) {
    console.error(`[email] Failed to send email to ${to}:`, error);
    return { ok: false, reason: "smtp_error", error: error.message };
  }
}
