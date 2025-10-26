import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST(){
  clearSessionCookie();
  return NextResponse.redirect(new URL('/logout', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}

export async function GET(){
  clearSessionCookie();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return NextResponse.redirect(new URL('/logout', baseUrl));
}
