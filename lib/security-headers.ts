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

export function validateRequestOrigin(req: Request): OriginValidationResult {
  // Only enforce strict Origin/Referer checks in production to avoid breaking local/dev tools
  if (process.env.NODE_ENV !== 'production') {
    return { ok: true };
  }

  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!allowedOrigin) {
    // If not configured, do not block requests to avoid accidental outage
    return { ok: true };
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const header = origin || referer;

  if (!header) {
    return { ok: false, reason: 'Missing Origin/Referer header' };
  }

  try {
    const requestUrl = new URL(header);
    const allowedUrl = new URL(allowedOrigin);

    if (requestUrl.protocol === allowedUrl.protocol && requestUrl.host === allowedUrl.host) {
      return { ok: true };
    }

    return { ok: false, reason: 'Untrusted Origin/Referer' };
  } catch {
    return { ok: false, reason: 'Invalid Origin/Referer' };
  }
}
