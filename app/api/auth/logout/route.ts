import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getAuthSecret } from '@/lib/auth';
import { blacklistToken, extractJtiFromToken, revokeDriverSessions } from '@/lib/session-manager';

const prisma = new PrismaClient();
const JWT_SECRET = getAuthSecret();

function extractDriverIdFromToken(token: string): number | null {
  const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { driverId?: number; id?: number; type?: string };
  if (decoded?.type !== 'driver') return null;
  const driverId = Number(decoded?.driverId ?? decoded?.id);
  if (!Number.isFinite(driverId) || driverId <= 0) return null;
  return driverId;
}

export async function POST(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const driverId = extractDriverIdFromToken(token);
      if (driverId) {
        await prisma.comDriver.update({
          where: { id: driverId },
          data: { isOnline: false, isBusy: false },
        });

        await revokeDriverSessions(driverId);

        const jti = extractJtiFromToken(token);
        if (jti) {
          const expiresAt = (jwt.decode(token) as any)?.exp
            ? new Date((jwt.decode(token) as any).exp * 1000)
            : undefined;
          await blacklistToken(jti, expiresAt);
        }
      }
    } catch (error) {
      console.error('Error updating driver status on logout:', error);
    }
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/logout', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}

export async function GET(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const driverId = extractDriverIdFromToken(token);
      if (driverId) {
        await prisma.comDriver.update({
          where: { id: driverId },
          data: { isOnline: false, isBusy: false },
        });

        await revokeDriverSessions(driverId);

        const jti = extractJtiFromToken(token);
        if (jti) {
          const expiresAt = (jwt.decode(token) as any)?.exp
            ? new Date((jwt.decode(token) as any).exp * 1000)
            : undefined;
          await blacklistToken(jti, expiresAt);
        }
      }
    } catch (error) {
      console.error('Error updating driver status on logout:', error);
    }
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  }
  await clearSessionCookie();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL('/logout', baseUrl));
}
