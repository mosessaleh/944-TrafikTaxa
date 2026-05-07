import { NextResponse } from 'next/server';
import { ensureDevelopmentOnly } from '@/lib/dev-route';

export async function GET(){
  const blocked = ensureDevelopmentOnly();
  if (blocked) return blocked;

  const cfg = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    from: process.env.SMTP_FROM,
    secureGuessed: (process.env.SMTP_PORT||'') === '465' ? true : false,
    cookieSecure: process.env.COOKIE_SECURE,
    appUrl: process.env.NEXT_PUBLIC_APP_URL
  };
  return NextResponse.json({ ok:true, cfg });
}
