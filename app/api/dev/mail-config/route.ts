import { NextResponse } from 'next/server';

export async function GET(){
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
