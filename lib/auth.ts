import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sign, verify } from 'jsonwebtoken';
import { comparePassword as cmp, hashPassword as hsh } from '@/lib/crypto';
import { randomBytes } from 'crypto';
import { hasPermission, isStaffRole, Permission } from '@/lib/permissions';

function resolveAuthSecret() {
  const configuredSecret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET/JWT_SECRET env var is required in production and must be at least 32 characters');
  }

  const ephemeralSecret = randomBytes(48).toString('hex');
  console.warn('⚠️ AUTH_SECRET/JWT_SECRET is missing or too short. Using an ephemeral development secret for this process only.');
  return ephemeralSecret;
}

const SECRET = resolveAuthSecret();

export function getAuthSecret(){
  return SECRET;
}

export function signToken(payload: Record<string, any>){
  return sign(payload, SECRET, { expiresIn: '7d' });
}

export async function hashPassword(password: string){ return hsh(password); }
export async function comparePassword(plain: string, hashed: string){ return cmp(plain, hashed); }

export async function setSessionCookie(token: string){
  const jar = await cookies();
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

export async function clearSessionCookie(){
  const jar = await cookies();
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
  const jar = await cookies();
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
    } else if (dec.type === 'driver') {
      // Driver session
      const driver = await prisma.comDriver.findUnique({
        where: { id: dec.id },
        select: {
          id: true,
          drUsername: true,
          drFname: true,
          drLname: true,
          drEmail: true,
          drPhone: true,
          isOnline: true,
          isActive: true,
          comId: true,
          car: true,
          company: {
            select: {
              comName: true,
              comStatus: true
            }
          }
        }
      });

      if (!driver || !driver.isActive) {
        return null;
      }

      return {
        ...driver,
        type: 'driver'
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
          language: true as any,
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

      console.log('🔐 getUserFromCookie: Returning user object:', { id: user.id, type: 'user', email: user.email });
      return {
        ...user,
        type: 'user'
      };
    }
  }catch(error: any){
    console.log('🔐 getUserFromCookie: Token verification failed:', error?.message || error);
    // Log suspicious activity in production
    if (process.env.NODE_ENV === 'production') {
      console.warn('Invalid session token detected:', error);
    }
    return null;
  }
}

export async function getUserFromBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const decoded: any = verify(token, SECRET);

    if (!decoded?.id || decoded?.type !== 'user') {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.id) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        language: true as any,
        emailVerified: true,
        pendingEmail: true,
        canPayByInvoice: true,
        createdAt: true,
      }
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      type: 'user',
    };
  } catch {
    return null;
  }
}

export async function getUserFromRequest(request: Request) {
  return (await getUserFromCookie()) || (await getUserFromBearerToken(request));
}

export async function requireAdmin(){
  const u = await getUserFromCookie();
  if (!u) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (u.type !== 'user' || !isStaffRole((u as any).role)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}

export async function requirePermission(permission: Permission){
  const u = await getUserFromCookie();
  if (!u) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (u.type !== 'user' || !hasPermission((u as any).role, permission)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return u;
}

export async function requireDriver(){
  const u = await getUserFromCookie();
  if (!u) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  if (u.type !== 'driver') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}

export async function requireDriverByApiKey(req: Request){
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  const apiKey = authHeader.substring(7);

  const driver = await prisma.comDriver.findUnique({
    where: { apiKey },
    include: {
      company: {
        select: {
          comName: true,
          comStatus: true
        }
      }
    }
  });

  if (!driver || !driver.isActive) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  return {
    ...driver,
    type: 'driver'
  };
}

export async function requireDriverByJWT(req: Request){
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
  const token = authHeader.substring(7);

  try {
    console.log('requireDriverByJWT - Verifying token');
    const decoded: any = verify(token, SECRET);
    const driverId = Number(decoded?.driverId ?? decoded?.id);
    console.log('requireDriverByJWT - Token decoded:', {
      driverId,
      rawDriverId: decoded?.driverId,
      rawId: decoded?.id,
      type: decoded?.type,
      exp: decoded?.exp
    });

    if (!Number.isFinite(driverId) || driverId <= 0 || decoded?.type !== 'driver') {
      console.log('requireDriverByJWT - Invalid token payload');
      throw Object.assign(new Error('Invalid token'), { status: 401 });
    }

    const driver = await prisma.comDriver.findUnique({
      where: { id: driverId },
      include: {
        company: {
          select: {
            comName: true,
            comStatus: true
          }
        }
      }
    });

    if (!driver || !driver.isActive || !(driver as any).company?.comStatus) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    return {
      ...driver,
      type: 'driver'
    };
  } catch (error) {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  }
}
