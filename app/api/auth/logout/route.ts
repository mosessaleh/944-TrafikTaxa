import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // API call from driver app - set driver offline
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { driverId: number; type: string };
      if (decoded.type === 'driver') {
        await prisma.comDriver.update({
          where: { id: decoded.driverId },
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { driverId: number; type: string };
      if (decoded.type === 'driver') {
        await prisma.comDriver.update({
          where: { id: decoded.driverId },
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
