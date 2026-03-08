import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * CSRF Protection Utilities
 * Protects against Cross-Site Request Forgery attacks
 */

export interface CSRFTokenData {
  token: string;
  expiresAt: Date;
}

export const CSRF_COOKIE_NAME = 'csrf_token';

function getCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;

  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [name, ...rest] = segment.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return null;
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

// Generate a cryptographically secure CSRF token
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

// Validate CSRF token against stored token
export function validateCSRFToken(storedToken: string, requestToken: string): boolean {
  if (!storedToken || !requestToken) return false;

  // Use constant-time comparison to prevent timing attacks
  return safeCompare(storedToken, requestToken);
}

// Placeholder API kept for compatibility with any existing imports.
export async function storeCSRFToken(_userId: number, _token: string): Promise<void> {
  return;
}

// Placeholder API kept for compatibility with any existing imports.
export async function getCSRFToken(_userId: number): Promise<string | null> {
  return null;
}

// Middleware function to validate CSRF token
export async function validateCSRFMiddleware(request: Request, userId: number): Promise<boolean> {
  try {
    if (!userId || !Number.isFinite(Number(userId))) {
      return false;
    }

    // Get token from header
    const csrfToken = request.headers.get('x-csrf-token') ||
                      request.headers.get('csrf-token');

    if (!csrfToken) {
      console.warn('CSRF token missing from request');
      return false;
    }

    // Validate against CSRF cookie (double submit cookie pattern)
    const cookieToken = getCookieValue(request.headers.get('cookie'), CSRF_COOKIE_NAME);
    if (!cookieToken) {
      console.warn('CSRF cookie token missing from request');
      return false;
    }

    // Basic shape validation before constant-time compare
    if (csrfToken.length < 32 || cookieToken.length < 32) {
      return false;
    }

    return safeCompare(cookieToken, csrfToken);
  } catch (error) {
    console.error('CSRF validation error:', error);
    return false;
  }
}

// Generate and return CSRF token for client
export function createCSRFTokenResponse(): { csrfToken: string } {
  return {
    csrfToken: generateCSRFToken()
  };
}
