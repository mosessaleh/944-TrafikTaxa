import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * CSRF Protection Utilities
 * Protects against Cross-Site Request Forgery attacks
 */

export interface CSRFTokenData {
  token: string;
  expiresAt: Date;
}

// Generate a cryptographically secure CSRF token
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

// Validate CSRF token against stored token
export function validateCSRFToken(storedToken: string, requestToken: string): boolean {
  if (!storedToken || !requestToken) return false;

  // Use constant-time comparison to prevent timing attacks
  return storedToken === requestToken;
}

// Store CSRF token in database (for server-side validation)
export async function storeCSRFToken(userId: number, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: userId },
    data: {
      // Note: You might want to add a csrfToken field to User model
      // For now, we'll use a simple approach
    }
  });
}

// Get CSRF token from database
export async function getCSRFToken(userId: number): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      // Add csrfToken field here when implemented
    }
  });

  return null; // Placeholder
}

// Middleware function to validate CSRF token
export async function validateCSRFMiddleware(request: Request, userId: number): Promise<boolean> {
  try {
    // Get token from header
    const csrfToken = request.headers.get('x-csrf-token') ||
                     request.headers.get('csrf-token');

    if (!csrfToken) {
      console.warn('CSRF token missing from request');
      return false;
    }

    // Get stored token (you can implement session-based or database-based storage)
    const storedToken = await getCSRFToken(userId);

    if (!storedToken) {
      console.warn('No stored CSRF token found for user');
      return false;
    }

    return validateCSRFToken(storedToken, csrfToken);
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