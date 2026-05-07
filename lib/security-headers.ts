// Enhanced security headers with comprehensive protection
export function withSecurityHeaders(resp: Response){
  const headers = new Headers(resp.headers);

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff');

  // Control referrer information
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent XSS via reflected downloads
  headers.set('X-Download-Options', 'noopen');

  // Prevent IE from executing downloads in context
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // 2 years HSTS; enable only behind HTTPS in production
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Enhanced CSP with stricter policies
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.stripe.com https://*.paypal.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com https://www.googletagmanager.com",
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://api.stripe.com https://api.paypal.com wss://*.stripe.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');

  headers.set('Content-Security-Policy', csp);

  // Additional security headers
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}


export type OriginValidationResult = {
  ok: boolean;
  reason?: string;
};

function normalizeOriginList(values: Array<string | undefined>): string[] {
  const uniqueOrigins = new Set<string>();

  for (const value of values) {
    if (!value) continue;

    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    for (const item of items) {
      try {
        const parsed = new URL(item);
        uniqueOrigins.add(`${parsed.protocol}//${parsed.host}`);
      } catch {
        // Skip invalid configured origins instead of trusting malformed values.
      }
    }
  }

  return Array.from(uniqueOrigins);
}

function getTrustedAppOrigins(): string[] {
  return normalizeOriginList([
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.PUBLIC_BASE_URL
  ]);
}

function matchesTrustedOrigin(headerValue: string | null, allowedOrigins: string[]): boolean {
  if (!headerValue) return false;

  try {
    const parsed = new URL(headerValue);
    const origin = `${parsed.protocol}//${parsed.host}`;
    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

export function validateRequestOrigin(req: Request): OriginValidationResult {
  // Only enforce strict Origin/Referer checks in production to avoid breaking local/dev tools
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true };
  }

  const allowedOrigins = getTrustedAppOrigins();
  if (allowedOrigins.length === 0) {
    return { ok: false, reason: 'Trusted app origin is not configured' };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  if (matchesTrustedOrigin(origin, allowedOrigins) || matchesTrustedOrigin(referer, allowedOrigins)) {
    return { ok: true };
  }

  if (!origin && !referer) {
    return { ok: false, reason: 'Missing Origin/Referer header' };
  }

  return { ok: false, reason: 'Untrusted Origin/Referer' };
}

/**
 * Validate request origin for driver API endpoints with environment-specific rules
 */
export function validateDriverApiOrigin(req: Request): OriginValidationResult {
  const authHeader = req.headers.get('authorization');
  const allowedDriverOrigins = normalizeOriginList([
    process.env.ALLOWED_DRIVER_ORIGINS,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL
  ]);

  // If using API key authentication, apply environment-specific rules
  if (authHeader?.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development') {
      // In development, allow all requests
      return { ok: true };

    } else {
      const origin = req.headers.get('origin');
      const referer = req.headers.get('referer');
      if (
        matchesTrustedOrigin(origin, allowedDriverOrigins) ||
        matchesTrustedOrigin(referer, allowedDriverOrigins)
      ) {
        return { ok: true };
      }

      // Native/mobile clients may omit these headers; keep them working while still rejecting mismatched browser origins.
      if (!origin && !referer) {
        return { ok: true };
      }

      return { ok: false, reason: 'Untrusted driver origin' };
    }
  }

  // For non-API key requests, fall back to standard validation
  return validateRequestOrigin(req);
}
