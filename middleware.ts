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


  // Enhanced security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Download-Options', 'noopen');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Enhanced CSP with production-ready policies
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://*.stripe.com https://*.paypal.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Allow inline/eval for Next dev tooling; includes ws: for HMR + Stripe
    ...(isDev ? ["script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com"]
              : ["script-src 'self' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com"]),
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.stripe.com https://api.paypal.com" +
      (isDev ? " ws:" : ""),
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"])
  ].join('; ');
  res.headers.set('Content-Security-Policy', csp);

  // Additional security headers
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/dev/.*).*)']
};
