import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearerToken, setSessionCookie } from '@/lib/auth';

const isSafeRedirect = (value: string) => value.startsWith('/') && !value.startsWith('//');

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromBearerToken(request);
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const redirectTarget = request.nextUrl.searchParams.get('redirect') || '/';
    const targetPath = isSafeRedirect(redirectTarget) ? redirectTarget : '/';

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    await setSessionCookie(token);

    return NextResponse.redirect(new URL(targetPath, request.url));
  } catch (error) {
    console.error('[mobile bridge] failed to create session:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
