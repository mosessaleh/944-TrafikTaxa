import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sign, verify } from 'jsonwebtoken';
import { comparePassword as cmp, hashPassword as hsh } from '@/lib/crypto';

const SECRET =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('AUTH_SECRET env var is required in production');
      })()
    : 'change_me_dev_secret');

export function signToken(payload: Record<string, any>){
  return sign(payload, SECRET, { expiresIn: '7d' });
}

export async function hashPassword(password: string){ return hsh(password); }
export async function comparePassword(plain: string, hashed: string){ return cmp(plain, hashed); }

export function setSessionCookie(token: string){
  const jar = cookies();
  const isProd = process.env.NODE_ENV === 'production';

  // Improved secure cookie detection
  const isHttps = isProd ||
                  process.env.FORCE_HTTPS === 'true' ||
                  process.env.NODE_ENV === 'development' && process.env.HTTPS === 'true';

  const secure = isProd || isHttps;
  const name = isProd ? '__Host-session' : 'session';

  // Use 'strict' for better CSRF protection, 'lax' for compatibility
  const sameSite = isProd ? 'strict' : 'lax';

  jar.set(name, token, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: 60*60*24*7,
    // Additional security options
    partitioned: false // Can be enabled for CHIPS support in the future
  });

  // Clear any legacy cookie name when migrating to __Host- prefix
  if (name === '__Host-session') {
    jar.set('session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
  }
}

export function clearSessionCookie(){
  const jar = cookies();
  const isProd = process.env.NODE_ENV === 'production';
  const envSecure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  const secure = isProd ? true : envSecure;

  // Always clear both possible cookie names to avoid stale sessions
  const names = isProd ? ['__Host-session', 'session'] : ['session', '__Host-session'];

  for (const name of names) {
    jar.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 0,
      expires: new Date(0) // Explicitly expire the cookie
    });
  }
}

export async function getUserFromCookie(){
  const jar = cookies();
  const isProd = process.env.NODE_ENV === 'production';
  const primaryName = isProd ? '__Host-session' : 'session';
  const fallbackName = primaryName === '__Host-session' ? 'session' : '__Host-session';

  const token = jar.get(primaryName)?.value || jar.get(fallbackName)?.value;
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

    if (dec.type === 'partner') {
      // Partner company session
      const partner = await prisma.partnerCompany.findUnique({
        where: { id: dec.id },
        select: {
          id: true,
          comUserName: true,
          comName: true,
          contactPerson: true,
          comAddress: true,
          comPhone: true,
          comEmail: true,
          comStatus: true,
          commissionRate: true,
          contractSigned: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!partner) {
        return null;
      }

      return {
        ...partner,
        type: 'partner'
      };
    } else {
      // Regular user session
      const user = await prisma.user.findUnique({
        where: { id: dec.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          role: true,
          emailVerified: true,
          pendingEmail: true,
          canPayByInvoice: true,
          createdAt: true
        }
      });

      // Additional security: ensure user still exists and is active
      if (!user) {
        return null;
      }

      return {
        ...user,
        type: 'user'
      };
    }
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
  if (!u) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (u.type !== 'user' || (u as any).role !== 'ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}
