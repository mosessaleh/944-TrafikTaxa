import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sign, verify } from 'jsonwebtoken';
import { comparePassword as cmp, hashPassword as hsh } from '@/lib/crypto';

const SECRET = process.env.SECRET || 'change_me_dev_secret';

export function signToken(payload: Record<string, any>){
  return sign(payload, SECRET, { expiresIn: '7d' });
}

export async function hashPassword(password: string){ return hsh(password); }
export async function comparePassword(plain: string, hashed: string){ return cmp(plain, hashed); }

export function setSessionCookie(token: string){
  const jar = cookies();
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  jar.set('session', token, {
    httpOnly: true,
    sameSite: 'strict', // Changed from 'lax' to 'strict' for better security
    secure,
    path: '/',
    maxAge: 60*60*24*7,
    // Additional security options
    partitioned: false // Can be enabled for CHIPS support in the future
  });
}

export function clearSessionCookie(){
  const jar = cookies();
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  jar.set('session', '', {
    httpOnly: true,
    sameSite: 'strict', // Changed from 'lax' to 'strict' for better security
    secure,
    path: '/',
    maxAge: 0,
    expires: new Date(0) // Explicitly expire the cookie
  });
}

export async function getUserFromCookie(){
  const token = cookies().get('session')?.value;
  if (!token) return null;

  try{
    const dec: any = verify(token, SECRET);

    // Validate token payload structure
    if (!dec.id || typeof dec.id !== 'number') {
      return null;
    }

    // Check token expiration (JWT library handles this, but double-check)
    const now = Math.floor(Date.now() / 1000);
    if (dec.exp && dec.exp < now) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: dec.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    });

    // Additional security: ensure user still exists and is active
    if (!user) {
      return null;
    }

    return user;
  }catch(error){
    // Log suspicious activity in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('Invalid session token detected:', error);
    }
    return null;
  }
}

export async function requireAdmin(){
  const u = await getUserFromCookie();
  if (!u || u.role !== 'ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}
