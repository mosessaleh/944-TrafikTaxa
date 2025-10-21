import { NextRequest, NextResponse } from 'next/server';

function decodeRole(token: string | null): 'ADMIN' | 'USER' | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // Base64URL decode payload (no verification in middleware)
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    return payload?.role === 'ADMIN' ? 'ADMIN' : 'USER';
  } catch { return null; }
}

export function middleware(req: NextRequest){
  const { pathname } = req.nextUrl;
  const protectedPaths = ['/book','/bookings','/profile','/admin'];
  const needsAuth = protectedPaths.some(p => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get('session')?.value || null;
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // role-gate for admin
  if (pathname.startsWith('/admin')){
    const role = decodeRole(token);
    if (role !== 'ADMIN') return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/book/:path*','/bookings/:path*','/profile/:path*','/admin/:path*'] };
