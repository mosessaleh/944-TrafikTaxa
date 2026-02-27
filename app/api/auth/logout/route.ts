import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'change_me_dev_secret';

function extractDriverIdFromToken(token: string): number | null {
  const decoded = jwt.verify(token, JWT_SECRET) as { driverId?: number; id?: number; type?: string };
  if (decoded?.type !== 'driver') return null;
  const driverId = Number(decoded?.driverId ?? decoded?.id);
  if (!Number.isFinite(driverId) || driverId <= 0) return null;
  return driverId;
}

export async function POST(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // API call from driver app - set driver offline
    const token = authHeader.substring(7);
    try {
      const driverId = extractDriverIdFromToken(token);
      if (driverId) {
        await prisma.comDriver.update({
          where: { id: driverId },
          data: { isOnline: false, isBusy: false },
        });
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
    // API call from driver app - set driver offline
    const token = authHeader.substring(7);
    try {
      const driverId = extractDriverIdFromToken(token);
      if (driverId) {
        await prisma.comDriver.update({
          where: { id: driverId },
          data: { isOnline: false, isBusy: false },
        });
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
