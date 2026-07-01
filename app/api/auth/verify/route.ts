import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

const Schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

export async function POST(req: Request){
  try{
    const { email, code } = Schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok:false, error:'Account not found' }, { status:404 });

    if (user.emailVerified) {
      return NextResponse.json({ ok:true, already:true });
    }

    if (!user.emailVerifyCode || !user.emailVerifyExpires) {
      return NextResponse.json({ ok:false, error:'No verification code issued. Please resend a new code.' }, { status:400 });
    }

    if (user.emailVerifyCode !== code) {
      return NextResponse.json({ ok:false, error:'Invalid verification code' }, { status:400 });
    }

    if (user.emailVerifyExpires < new Date()) {
      return NextResponse.json({ ok:false, error:'Code expired. Please request a new code.' }, { status:400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifyCode: null, emailVerifyExpires: null }
    });

    await sendEmail(
      user.email,
      'Welcome to 944 Trafik - Membership Info',
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h1 style="color: #1a73e8; text-align: center;">Welcome to 944 Trafik, ${user.firstName}!</h1>
        <p>Your account has been verified successfully.</p>

        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="color: #1a73e8; font-size: 18px; margin-top: 0;">Your Membership</h2>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Status:</strong> Active Member</p>
        </div>

        <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="color: #2e7d32; font-size: 18px; margin-top: 0;">How to Book Rides</h2>

          <div style="margin-bottom: 16px;">
            <h3 style="color: #1a73e8; font-size: 16px;">Via Browser</h3>
            <p>Login to your account at <a href="https://944trafik.dk/login" style="color: #1a73e8;">944trafik.dk/login</a> using your email and password. You can book rides, track your driver, and manage your trips from the dashboard.</p>
          </div>

          <div style="margin-bottom: 16px; background: #fff; border-radius: 6px; padding: 12px;">
            <h3 style="color: #25d366; font-size: 16px;">Via WhatsApp</h3>
            <p><strong>Phone Number:</strong> +45 52 20 22 11</p>
            <p><strong>Website:</strong> <a href="https://taxa.944trafik.dk" style="color: #1a73e8;">taxa.944trafik.dk</a></p>
            <p>Simply send a message to our WhatsApp number with your pickup location and destination to book a ride. Our team will confirm your booking and assign a driver.</p>
          </div>
        </div>

        <div style="background: #fff3e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="color: #e65100; font-size: 18px; margin-top: 0;">Login Methods</h2>
          <p><strong>Browser:</strong> Visit <a href="https://944trafik.dk/login" style="color: #1a73e8;">944trafik.dk/login</a></p>
          <p><strong>Mobile App:</strong> Download our app and login with your email and password</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 13px;">Need help? Contact us at <a href="mailto:support@944trafik.dk" style="color: #1a73e8;">support@944trafik.dk</a></p>
          <p style="color: #999; font-size: 12px;">&copy; ${new Date().getFullYear()} 944 Trafik. All rights reserved.</p>
        </div>
      </div>`
    );

    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e?.message||'Invalid request' }, { status:400 });
  }
}
