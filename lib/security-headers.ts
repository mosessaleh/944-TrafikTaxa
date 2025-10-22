// Common security headers. Adjust CSP according to your asset domains.
export function withSecurityHeaders(resp: Response){
  const headers = new Headers(resp.headers);
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  // 2 years HSTS; enable only behind HTTPS in production
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // Basic CSP (adjust img-src/font-src/script-src as you add CDNs)
  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://*.tile.openstreetmap.org",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
  headers.set('Content-Security-Policy', csp);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}
