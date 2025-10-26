import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/sanitize';
import { limitOrThrow, clientIpKey } from '@/lib/rate-limit';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Rate limiting for sensitive endpoints
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify',
    '/api/auth/resend-code'
  ];

  if (sensitiveEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    try {
      const clientKey = clientIpKey(req);
      await limitOrThrow(clientKey, { points: 5, durationSec: 300 }); // 5 requests per 5 minutes
    } catch (error: any) {
      if (error.status === 429) {
        const retryRes = NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
        retryRes.headers.set('Retry-After', error.retryAfter.toString());
        return retryRes;
      }
    }
  }


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
