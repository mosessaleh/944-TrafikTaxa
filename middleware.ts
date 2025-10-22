import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  // Core security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // CSP — relaxed for Next dev (inline/eval + ws for HMR). You can tighten later with nonce.
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://*.tile.openstreetmap.org",
    "style-src 'self' 'unsafe-inline'",
    // Allow inline/eval for Next dev tooling; includes ws: for HMR
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org ws:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  res.headers.set('Content-Security-Policy', csp);

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/dev/.*).*)']
};
