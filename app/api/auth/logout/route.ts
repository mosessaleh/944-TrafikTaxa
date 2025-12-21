import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // API call from driver app
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  }
  clearSessionCookie();
  return NextResponse.redirect(new URL('/logout', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}

export async function GET(request: NextRequest){
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // API call from driver app
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  }
  clearSessionCookie();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL('/logout', baseUrl));
}
