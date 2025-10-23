import nodemailer from "nodemailer";

export async function sendEmail(to: string, subject: string, html: string) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.FROM_EMAIL || user;

  if (!host || !user || !pass || !from) {
    console.warn("[email] SMTP not configured. Printing email to console instead.");
    console.log({ to, subject, html });
    return { ok: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass }
  });

  await transporter.sendMail({ from, to, subject, html });
  return { ok: true };
}
