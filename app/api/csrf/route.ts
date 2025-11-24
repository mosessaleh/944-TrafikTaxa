import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { createCSRFTokenResponse } from '@/lib/csrf';
import { limitCSRFAttempts, clientIpKey } from '@/lib/rate-limit';

/**
 * GET /api/csrf
 * Returns a CSRF token for the authenticated user
 * This token should be included in subsequent requests that modify data
 */
export async function GET(request: Request) {
  try {
    // Rate limiting for CSRF token requests
    const clientKey = clientIpKey(request);
    await limitCSRFAttempts(clientKey);

    const user = await getUserFromCookie();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Generate and return CSRF token
    const tokenResponse = createCSRFTokenResponse();

    return NextResponse.json({
      success: true,
      ...tokenResponse
    });

  } catch (error) {
    console.error('CSRF token generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}