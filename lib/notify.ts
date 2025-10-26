import { sendEmail } from "./email";

function createEmailTemplate(title: string, content: string, actionText?: string, actionUrl?: string) {
  const actionButton = actionText && actionUrl ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">${actionText}</a>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - 944 Trafik</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f9fa;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #000 0%, #333 100%); padding: 40px 30px; text-align: center;">
          <div style="font-size: 28px; font-weight: bold; color: #fff; margin-bottom: 8px;">944</div>
          <div style="font-size: 16px; color: #ddd; letter-spacing: 2px;">TRAFIK</div>
          <div style="font-size: 14px; color: #bbb; margin-top: 4px;">Reliable Transportation</div>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h1 style="color: #333; font-size: 24px; margin: 0 0 20px 0; text-align: center;">${title}</h1>
          <div style="color: #555; line-height: 1.6; font-size: 16px;">
            ${content}
          </div>
          ${actionButton}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
          <div style="color: #666; font-size: 14px; margin-bottom: 15px;">
            <strong>944 Trafik</strong><br>
            Professional Taxi Services in Copenhagen
          </div>
          <div style="color: #999; font-size: 12px;">
            Contact us: +45 26 44 49 44 | info@944.dk<br>
            <a href="https://944.dk" style="color: #666; text-decoration: none;">www.944.dk</a>
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9ecef; color: #999; font-size: 11px;">
            This email was sent to you because you have an account with 944 Trafik.<br>
            If you have any questions, please contact our support team.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function notifyUserEmail(to: string, subject: string, body: string) {
  try {
    return await sendEmail(to, subject, body);
  } catch (e:any) {
    console.error("[notify] user email failed", e);
    return { ok: false, error: String(e) };
  }
}

export async function notifyUserWelcome(to: string, firstName: string) {
  const subject = "Welcome to 944 Trafik! 🎉";
  const content = `
    <p>Dear ${firstName},</p>
    <p>Welcome to <strong>944 Trafik</strong>! We're excited to have you join our community of satisfied customers.</p>
    <p>With 944 Trafik, you can easily book reliable taxi services throughout Copenhagen and beyond. Our professional drivers are ready to provide you with safe, comfortable, and punctual transportation.</p>
    <p><strong>What you can do now:</strong></p>
    <ul>
      <li>Book rides instantly through our website</li>
      <li>Save your favorite addresses for quick booking</li>
      <li>Track your ride history and receipts</li>
      <li>Enjoy competitive pricing and excellent service</li>
    </ul>
    <p>If you have any questions or need assistance, our support team is here to help.</p>
    <p>Safe travels!<br>The 944 Trafik Team</p>
  `;
  const html = createEmailTemplate("Welcome to 944 Trafik!", content, "Book Your First Ride", "https://944.dk/book");
  return notifyUserEmail(to, subject, html);
}

export async function notifyUserEmailVerification(to: string, firstName: string, verificationCode: string) {
  const subject = "Verify Your Email - 944 Trafik";
  const content = `
    <p>Dear ${firstName},</p>
    <p>Thank you for registering with <strong>944 Trafik</strong>! To complete your account setup and start booking rides, please verify your email address.</p>
    <p><strong>Your verification code is:</strong></p>
    <div style="background-color: #f8f9fa; border: 2px solid #000; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 4px;">
      ${verificationCode}
    </div>
    <p>Enter this code on our website to verify your email. This code will expire in 24 hours.</p>
    <p>If you didn't create an account with 944 Trafik, please ignore this email.</p>
    <p>Best regards,<br>The 944 Trafik Team</p>
  `;
  const html = createEmailTemplate("Verify Your Email", content, "Verify Email", "https://944.dk/verify");
  return notifyUserEmail(to, subject, html);
}

export async function notifyUserBookingConfirmation(to: string, firstName: string, bookingDetails: any) {
  const subject = "Your Ride is Confirmed! 🚕";
  const content = `
    <p>Dear ${firstName},</p>
    <p>Great news! Your taxi booking has been confirmed and is now being processed.</p>
    <div style="background-color: #f0f8ff; border-left: 4px solid #000; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Booking Details:</h3>
      <p><strong>From:</strong> ${bookingDetails.pickupAddress}</p>
      <p><strong>To:</strong> ${bookingDetails.dropoffAddress}</p>
      <p><strong>Date & Time:</strong> ${new Date(bookingDetails.pickupTime).toLocaleString('en-DK')}</p>
      <p><strong>Passengers:</strong> ${bookingDetails.passengers}</p>
      <p><strong>Vehicle:</strong> ${bookingDetails.vehicleType}</p>
      <p><strong>Total Price:</strong> ${bookingDetails.price} DKK</p>
      <p><strong>Booking ID:</strong> #${bookingDetails.id}</p>
    </div>
    <p>Our dispatcher will assign a driver shortly. You will receive a notification when your driver is on the way.</p>
    <p>For any changes or questions, please contact us immediately.</p>
    <p>Thank you for choosing 944 Trafik!</p>
  `;
  const html = createEmailTemplate("Your Ride is Confirmed!", content, "Track Your Ride", "https://944.dk/bookings");
  return notifyUserEmail(to, subject, html);
}

export async function notifyUserPaymentReceived(to: string, firstName: string, paymentDetails: any) {
  const subject = "Payment Received - Thank You! 💳";
  const content = `
    <p>Dear ${firstName},</p>
    <p>We've successfully received your payment for the taxi booking.</p>
    <div style="background-color: #f0fff0; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Payment Details:</h3>
      <p><strong>Amount Paid:</strong> ${paymentDetails.amount} DKK</p>
      <p><strong>Payment Method:</strong> ${paymentDetails.method}</p>
      <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId}</p>
      <p><strong>Booking ID:</strong> #${paymentDetails.bookingId}</p>
    </div>
    <p>Your booking is now fully confirmed. Our driver will pick you up at the scheduled time.</p>
    <p>A receipt has been added to your account history.</p>
    <p>Safe travels!</p>
  `;
  const html = createEmailTemplate("Payment Received", content, "View Receipt", "https://944.dk/bookings");
  return notifyUserEmail(to, subject, html);
}

export async function notifyAdmin(subject: string, body: string) {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin) {
    console.warn("[notify] ADMIN_EMAIL not set. Skipping admin email.");
    return { ok: false, reason: "admin_email_not_set" };
  }
  return notifyUserEmail(admin, subject, body);
}
