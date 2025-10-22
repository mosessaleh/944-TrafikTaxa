import { NextResponse } from 'next/server';

export async function POST(req: Request){
  // كل الكود داخل try شامل، مع استيرادات ديناميكية لمنع أخطاء وقت تحميل الملف
  try{
    const bodyText = await req.text();
    let parsed: any;
    try { parsed = JSON.parse(bodyText || '{}'); } catch { return NextResponse.json({ ok:false, error:'Invalid JSON body' }, { status:400 }); }

    // استيرادات ديناميكية داخل الهاندلر
    const [{ z }, { prisma }, authMod, rl] = await Promise.all([
      import('zod'),
      import('@/lib/db'),
      import('@/lib/auth'),
      import('@/lib/rate-limit')
    ]);

    const Schema = z.object({ email: z.string().email(), password: z.string().min(6) });
    const { email, password } = Schema.parse(parsed);

    // Rate limit آمن
    try{ await rl.limitOrThrow('login:'+rl.clientIpKey(req), { points: 5, durationSec: 60 }); } 
    catch(e:any){ return NextResponse.json({ ok:false, error:'Too many attempts. Try again shortly.' }, { status: e?.status||429 }); }

    // الاستعلام عن المستخدم
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) return NextResponse.json({ ok:false, error:'Invalid email or password' }, { status:401 });

    // مقارنة كلمة السر (lib/crypto مستخدم عبر lib/auth)
    const ok = await authMod.comparePassword(password, user.hashedPassword);
    if (!ok) return NextResponse.json({ ok:false, error:'Invalid email or password' }, { status:401 });

    // إنشاء الجلسة ككوكي
    const token = authMod.signToken({ id: user.id });
    authMod.setSessionCookie(token);

    return NextResponse.json({ ok:true, user: { id:user.id, email:user.email, role:user.role, emailVerified:user.emailVerified, firstName:user.firstName, lastName:user.lastName } });
  }catch(e:any){
    // لوج للخادم + رد JSON دائم
    console.error('[auth/login] fatal', e?.stack||e?.message||e);
    return NextResponse.json({ ok:false, error:'Login failed (server)' }, { status:500 });
  }
}
