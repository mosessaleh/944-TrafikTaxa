import { sendEmail } from "./email";

export async function notifyUserEmail(to: string, subject: string, body: string) {
  try {
    return await sendEmail(to, subject, body);
  } catch (e:any) {
    console.error("[notify] user email failed", e);
    return { ok: false, error: String(e) };
  }
}

export async function notifyAdmin(subject: string, body: string) {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) {
    console.warn("[notify] ADMIN_EMAIL not set. Skipping admin email.");
    return { ok: false, reason: "admin_email_not_set" };
  }
  return notifyUserEmail(admin, subject, body);
}
