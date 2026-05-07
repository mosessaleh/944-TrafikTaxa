import { NextResponse } from 'next/server';

export function ensureDevelopmentOnly() {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  return NextResponse.json({ ok: false, error: 'Not available' }, { status: 404 });
}
