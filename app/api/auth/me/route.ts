import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie, getAuthSecret } from '@/lib/auth';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = getAuthSecret();

async function getUserFromBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id?: number; type?: string };
    if (decoded?.type && decoded.type !== 'user') {
      return null;
    }

    const userId = Number(decoded?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    return { id: userId };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest){
  const bearerUser = await getUserFromBearerToken(request);
  const u = bearerUser || await getUserFromCookie();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  const { prisma } = await import('@/lib/db');
  const userWithPermission = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, address: true, role: true, canPayByInvoice: true, language: true }
  });
  return NextResponse.json({ ok:true, user: userWithPermission });
}
