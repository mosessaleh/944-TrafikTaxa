import { NextResponse } from 'next/server';
import { validateRequestOrigin } from '@/lib/security-headers';

export async function POST(req: Request){
  // كل الكود داخل try شامل، مع استيرادات ديناميكية لمنع أخطاء وقت تحميل الملف
  try{
    const originCheck = validateRequestOrigin(req);
    if (!originCheck.ok) {
      return NextResponse.json(
        { ok:false, error:'Invalid request origin' },
        { status: 403 }
      );
    }

    const bodyText = await req.text();
    let parsed: any;
    try { parsed = JSON.parse(bodyText || '{}'); } catch { return NextResponse.json({ ok:false, error:'Invalid JSON body' }, { status:400 }); }

    // استيرادات ديناميكية داخل الهاندلر
    const [{ z }, { prisma }, authMod, rl, { AuditLogger }] = await Promise.all([
      import('zod'),
      import('@/lib/db'),
      import('@/lib/auth'),
      import('@/lib/rate-limit'),
      import('@/lib/audit-log')
    ]);

    const Schema = z.object({
      email: z.string().email().optional(),
      username: z.string().optional(),
      password: z.string().min(6),
      type: z.enum(['user', 'partner']).default('user')
    });
    const { email, username, password, type } = Schema.parse(parsed);

    // Rate limit آمن
    try{ await rl.limitOrThrow('login:'+rl.clientIpKey(req), { points: 5, durationSec: 60 }); }
    catch(e:any){ return NextResponse.json({ ok:false, error:'Too many attempts. Try again shortly.' }, { status: e?.status||429 }); }

    let authenticatedUser: any = null;
    let userType: 'user' | 'partner' = 'user';

    if (type === 'partner') {
      // Partner company login
      if (!username) {
        return NextResponse.json({ ok:false, error:'Username is required for partner login' }, { status:400 });
      }

      const partner = await prisma.partnerCompany.findFirst({ where: { comUserName: username } });
      if (!partner) {
        await AuditLogger.logLoginFailed(username, rl.clientIpKey(req), req.headers.get('user-agent') || '');
        return NextResponse.json({ ok:false, error:'Invalid username or password' }, { status:401 });
      }

      const ok = await authMod.comparePassword(password, partner.comPass);
      if (!ok) {
        await AuditLogger.logLoginFailed(username, rl.clientIpKey(req), req.headers.get('user-agent') || '');
        return NextResponse.json({ ok:false, error:'Invalid username or password' }, { status:401 });
      }

      authenticatedUser = {
        id: partner.id,
        username: partner.comUserName,
        name: partner.comName,
        type: 'partner'
      };
      userType = 'partner';
    } else {
      // User login
      if (!email) {
        return NextResponse.json({ ok:false, error:'Email is required for user login' }, { status:400 });
      }

      const user = await prisma.user.findFirst({ where: { email } });
      if (!user) {
        await AuditLogger.logLoginFailed(email, rl.clientIpKey(req), req.headers.get('user-agent') || '');
        return NextResponse.json({ ok:false, error:'Invalid email or password' }, { status:401 });
      }

      const ok = await authMod.comparePassword(password, user.hashedPassword);
      if (!ok) {
        await AuditLogger.logLoginFailed(email, rl.clientIpKey(req), req.headers.get('user-agent') || '');
        return NextResponse.json({ ok:false, error:'Invalid email or password' }, { status:401 });
      }

      authenticatedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        firstName: user.firstName,
        lastName: user.lastName,
        type: 'user'
      };
      userType = 'user';
    }

    // إنشاء الجلسة ككوكي
    const token = authMod.signToken({ id: authenticatedUser.id, type: userType });
    const redirectUrl = userType === 'partner' ? '/partner/dashboard' : '/';
    const res = NextResponse.json({ ok:true, user: authenticatedUser, token: token, next: redirectUrl });
    
        const isProd = process.env.NODE_ENV === 'production';
        const envSecure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
        const secure = isProd ? true : envSecure;
        const name = isProd ? '__Host-session' : 'session';
    
        res.cookies.set(name, token, {
          httpOnly: true,
          sameSite: 'lax',
          secure,
          path: '/',
          maxAge: 60*60*24*7
        });
    
        // Clear legacy cookie name when migrating to __Host- prefix
        if (name === '__Host-session') {
          res.cookies.set('session', '', {
            httpOnly: true,
            sameSite: 'lax',
            secure,
            path: '/',
            maxAge: 0,
            expires: new Date(0)
          });
        }

    // تسجيل تسجيل دخول ناجح
    await AuditLogger.logLoginSuccess(authenticatedUser.id.toString(), rl.clientIpKey(req), req.headers.get('user-agent') || '');

    return res;
  }catch(e:any){
    // لوج للخادم + رد JSON دائم
    console.error('[auth/login] fatal', e?.stack||e?.message||e);
    return NextResponse.json({ ok:false, error:'Login failed (server)' }, { status:500 });
  }
}
