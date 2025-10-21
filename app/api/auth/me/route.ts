import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const SECRET = process.env.SECRET || 'dev_secret_change_me';

export async function GET(){
  const jar = cookies();
  const token = jar.get('session')?.value;
  if (!token) return NextResponse.json({ ok:false, error:'NO_COOKIE' }, { status:401 });
  try{
    const dec:any = verify(token, SECRET);
    const u = await prisma.user.findUnique({ where: { id: dec.id } });
    if (!u) return NextResponse.json({ ok:false, error:'NO_USER' }, { status:401 });
    return NextResponse.json({ ok:true, user:{ id:u.id, email:u.email, role:u.role, firstName:u.firstName, lastName:u.lastName, phone:u.phone, emailVerified: u.emailVerified } });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'BAD_TOKEN' }, { status:401 });
  }
}
