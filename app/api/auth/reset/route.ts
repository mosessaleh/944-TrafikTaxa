import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const Schema = z.object({ token: z.string().min(10), password: z.string().min(8) });

export async function POST(req: Request){
  try {
    const { token, password } = Schema.parse(await req.json());

    // Verify JWT token
    const secret = process.env.AUTH_SECRET || 'fallback_secret';
    let decoded: any;

    try {
      decoded = verify(token, secret);
    } catch (error) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 });
    }

    // Check if token is for password reset
    if (decoded.type !== 'password_reset' || !decoded.userId) {
      return NextResponse.json({ ok: false, error: 'Invalid token type' }, { status: 400 });
    }

    // Find user and check if token matches
    const u = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        resetToken: token
      }
    });

    if (!u || !u.resetExpires || u.resetExpires < new Date()) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 });
    }

    // Hash new password
    const hashed = await hashPassword(password);

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: u.id },
      data: {
        hashedPassword: hashed,
        resetToken: null,
        resetExpires: null
      }
    });

    return NextResponse.json({ ok: true, message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
