import { NextResponse } from 'next/server';
export async function POST(){
  const res = NextResponse.json({ ok:true });
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  res.cookies.set('session','', { httpOnly:true, secure, sameSite:'lax', path:'/', maxAge:0 });
  return res;
}
