import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sign } from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { limitOrThrow, clientIpKey } from '@/lib/rate-limit';
import { requireAuthSecret } from '@/lib/security-config';

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request){
  try {
    // Rate limiting for password reset requests
    const clientKey = clientIpKey(req);
    await limitOrThrow(`driver-reset:${clientKey}`, { points: 3, durationSec: 3600 }); // 3 requests per hour per IP

    const { email } = Schema.parse(await req.json());

    // Validate email format more thoroughly
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email format' }, { status: 400 });
    }

    const driver = await prisma.comDriver.findFirst({ where: { drEmail: email } });
    if (driver){
      // Create JWT token with driver ID and expiry
      const resetToken = sign(
        { driverId: driver.id, type: 'driver_password_reset' },
        requireAuthSecret('driver request-reset route'),
        { expiresIn: '30m' }
      );

      const exp = new Date(Date.now()+1000*60*30);
      await prisma.comDriver.update({ where: { id: driver.id }, data: { resetToken, resetExpires: exp } as any });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const url = `${baseUrl}/driver-reset?token=${encodeURIComponent(resetToken)}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello ${driver.drFname},</p>
          <p>We received a request to reset your password for your 944 Trafik Driver account.</p>
          <p>If you made this request, click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">Reset Password</a>
          </div>
          <p><strong>This link will expire in 30 minutes.</strong></p>
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <p>For security reasons, please don't share this email with anyone.</p>
          <p>Best regards,<br>The 944 Trafik Team</p>
        </div>
      `;

      await sendEmail(email, 'Password Reset - 944 Trafik Driver', html);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ ok: true, message: 'If an account with this email exists, a reset link has been sent.' });
  } catch (error: any) {
    if (error.status === 429) {
      return NextResponse.json(
        { ok: false, error: 'Too many reset requests. Please try again later.' },
        { status: 429 }
      );
    }
    console.error('Driver password reset error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}