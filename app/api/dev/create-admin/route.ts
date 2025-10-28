import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: Request){
  try{
    const { email, password, firstName, lastName, phone, address, token } = await req.json();
    if (!token || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ ok:false, error:'Forbidden' }, { status:403 });
    if (!email || !password) return NextResponse.json({ ok:false, error:'email and password required' }, { status:400 });
    const hashed = await hashPassword(password);
    const up = await prisma.user.upsert({
      where: { email },
      update: { hashedPassword: hashed, role:'ADMIN', emailVerified: true },
      create: {
        email,
        hashedPassword: hashed,
        firstName: firstName || 'Admin',
        lastName: lastName || 'User',
        phone: phone || '00000000',
        address: address || 'Admin Address',
        role: 'ADMIN',
        emailVerified: true
      }
    });
    return NextResponse.json({ ok:true, userId: up.id });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'failed' }, { status:500 });
  }
}
