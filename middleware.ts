import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { limitOrThrow, clientIpKey } from '@/lib/rate-limit';

function normalizeOriginList(values: Array<string | undefined>): string[] {
  const allowedOrigins = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    const entries = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const entry of entries) {
      try {
        const parsed = new URL(entry);
        allowedOrigins.add(`${parsed.protocol}//${parsed.host}`);
      } catch {
        // Ignore invalid configured origins.
      }
    }
  }

  return Array.from(allowedOrigins);
}

function normalizeRequestOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === 'development') {
    return normalizeOriginList([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.PUBLIC_BASE_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.APP_URL,
      process.env.ALLOWED_DRIVER_ORIGINS,
    ]);
  }

  return normalizeOriginList([
    process.env.PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.ALLOWED_DRIVER_ORIGINS,
  ]);
}

export async function middleware(req: NextRequest) {
  // Generate a per-request nonce for inline scripts/styles
  const nonce = crypto.randomUUID();

  // Propagate nonce to the rest of the app via a custom header
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-csp-nonce', nonce);

  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith('/api/dev/') && process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { ok: false, error: 'Not available' },
      { status: 404 }
    );
  }

  // Enhanced Origin validation for CSRF protection
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Define allowed origins
  const allowedOrigins = getAllowedOrigins();

  // Check origin for sensitive operations
  const sensitivePaths = ['/api/', '/admin/'];
  const isSensitivePath = sensitivePaths.some(path => pathname.startsWith(path));

  if (isSensitivePath && req.method !== 'GET' && req.method !== 'HEAD') {
    // Validate origin for POST/PUT/DELETE requests
    const normalizedOrigin = normalizeRequestOrigin(origin);
    if (normalizedOrigin && !allowedOrigins.includes(normalizedOrigin)) {
      return NextResponse.json(
        { error: 'Unauthorized origin' },
        { status: 403 }
      );
    }

    // Additional referer check for extra security
    if (referer) {
      try {
        const normalizedReferer = normalizeRequestOrigin(referer);
        const isAllowedReferer = normalizedReferer
          ? allowedOrigins.includes(normalizedReferer)
          : false;

        if (!isAllowedReferer) {
          return NextResponse.json(
            { error: 'Unauthorized referer' },
            { status: 403 }
          );
        }
      } catch (error) {
        // Invalid referer URL, block the request
        return NextResponse.json(
          { error: 'Invalid request' },
          { status: 400 }
        );
      }
    }
  }

  // Rate limiting for sensitive endpoints
  const sensitiveEndpoints = [
    '/api/auth/login',
    '/api/auth/driver-login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify',
    '/api/auth/resend-code',
    '/api/driver/login',
    '/api/driver/refresh-token',
    '/api/driver/request-reset',
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

  // Rate limiting for driver operational endpoints
  const driverOperationalEndpoints = [
    '/api/driver/status',
    '/api/driver/end-shift',
    '/api/driver/location-update',
    '/api/driver/rides',
    '/api/driver/bookings',
    '/api/driver/schedule',
    '/api/driver/ride-preferences',
  ];

  if (driverOperationalEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    try {
      const clientKey = clientIpKey(req);
      await limitOrThrow(`driver-op:${clientKey}`, { points: 300, durationSec: 60 }); // 300 req/min for mobile app location updates + status checks
    } catch (error: any) {
      if (error.status === 429) {
        const retryRes = NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429 }
        );
        retryRes.headers.set('Retry-After', error.retryAfter.toString());
        return retryRes;
      }
    }
  }

  // Light rate limiting for invoices and payment APIs
  const rateLimitedPrefixes = ['/api/invoices', '/api/payments', '/api/whatsapp/webhook'];
  const matchedPrefix = rateLimitedPrefixes.find(prefix => pathname.startsWith(prefix));

  if (matchedPrefix) {
    try {
      const clientKey = clientIpKey(req);
      await limitOrThrow(`rl:${matchedPrefix}:${clientKey}`, { points: 30, durationSec: 60 }); // ~30 req/min per IP per prefix
    } catch (error: any) {
      if (error.status === 429) {
        const retryRes = NextResponse.json(
          { error: 'Too many requests. Please slow down.' },
          { status: 429 }
        );
        retryRes.headers.set('Retry-After', error.retryAfter.toString());
        return retryRes;
      }
    }
  }

  let res = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  // In production, hide the actual /admin route behind a configurable, less guessable slug.
  // Example: set ADMIN_ROUTE_SLUG=portal-944-a17c and access via /portal-944-a17c instead of /admin.
  if (process.env.NODE_ENV === 'production' && process.env.ADMIN_ROUTE_SLUG) {
    const adminSlug = `/${process.env.ADMIN_ROUTE_SLUG}`;
    const adminSlugPrefix = `${adminSlug}/`;

    // Block direct access to /admin in production to reduce automated scanning noise
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Allow access via the secret slug and internally rewrite to /admin
    if (pathname === adminSlug || pathname.startsWith(adminSlugPrefix)) {
      const url = req.nextUrl.clone();
      url.pathname = pathname.replace(adminSlug, '/admin');
      res = NextResponse.rewrite(url, {
        request: {
          headers: requestHeaders
        }
      });
    }
  }

  // Enhanced security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Download-Options', 'noopen');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // TODO: Remove 'unsafe-inline' from script-src and style-src in production
  // Requires refactoring all inline styles/scripts to use nonces or external files

  // Enhanced CSP with nonce-based policies
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.stripe.com https://*.paypal.com https://maps.gstatic.com https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Allow inline/eval for Next dev tooling; includes ws: for HMR + Stripe + Google Analytics + Google Maps
    ...(isDev
      ? [`script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com https://www.googletagmanager.com https://maps.googleapis.com`]
      : [`script-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com https://www.googletagmanager.com https://maps.googleapis.com`]),
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.stripe.com https://api.paypal.com https://maps.googleapis.com" +
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

  // Only enable COEP/COOP/CORP on trusted origins (production)
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/.*|favicon.ico).*)']
};
