import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import { getAuthSecret } from '@/lib/auth';

const prisma = new PrismaClient();
const JWT_SECRET = getAuthSecret();

function getDriverIdFromToken(request: NextRequest): number | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    const driverId = Number(decoded?.driverId ?? decoded?.id);
    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') return null;
    return driverId;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const driverId = getDriverIdFromToken(request);
  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const preferences = await prisma.driver_ride_preferences.findUnique({ where: { driverId } });
    if (!preferences) return NextResponse.json({ success: true, preferences: null });
    return NextResponse.json({
      success: true,
      preferences: { minDistanceKm: preferences.minDistanceKm, minTimeMinutes: preferences.minTimeMinutes },
    });
  } catch (error) {
    console.error('Error fetching ride preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const driverId = getDriverIdFromToken(request);
  if (!driverId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const minDistanceKm = Number(body.minDistanceKm);
    const minTimeMinutes = Number(body.minTimeMinutes);
    if (!Number.isFinite(minDistanceKm) || !Number.isFinite(minTimeMinutes) || minDistanceKm < 0 || minTimeMinutes < 0) {
      return NextResponse.json({ error: 'Invalid values' }, { status: 400 });
    }
    const preferences = await prisma.driver_ride_preferences.upsert({
      where: { driverId },
      update: { minDistanceKm, minTimeMinutes },
      create: { driverId, minDistanceKm, minTimeMinutes },
    });
    return NextResponse.json({
      success: true,
      preferences: { minDistanceKm: preferences.minDistanceKm, minTimeMinutes: preferences.minTimeMinutes },
    });
  } catch (error) {
    console.error('Error saving ride preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
