import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAuthSecret } from '@/lib/security-config';

const Schema = z.object({ token: z.string().min(10), password: z.string().min(8) });

export async function POST(req: Request){
  try {
    const { token, password } = Schema.parse(await req.json());

    // Verify token
    const decoded = verify(token, requireAuthSecret('driver reset route')) as any;

    if (decoded.type !== 'driver_password_reset' || !decoded.driverId) {
      return NextResponse.json({ ok: false, error: 'Invalid token type' }, { status: 400 });
    }

    // Check if token is valid and not expired
    const driver = await prisma.comDriver.findUnique({
      where: { id: decoded.driverId }
    }) as any;

    if (!driver || driver.resetToken !== token || !driver.resetExpires || driver.resetExpires < new Date()) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 });
    }

    // Hash new password
    const hashed = await hashPassword(password);

    // Update driver password and clear reset token
    await prisma.comDriver.update({
      where: { id: decoded.driverId },
      data: {
        drPass: hashed,
        resetToken: null,
        resetExpires: null
      } as any
    });

    return NextResponse.json({ ok: true, message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Driver password reset error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}