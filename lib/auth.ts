import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sign, verify } from 'jsonwebtoken';
import { comparePassword as cmp, hashPassword as hsh } from '@/lib/crypto';

const SECRET = process.env.SECRET || 'change_me_dev_secret';

export function signToken(payload: Record<string, any>){
  return sign(payload, SECRET, { expiresIn: '7d' });
}

export async function hashPassword(password: string){ return hsh(password); }
export async function comparePassword(plain: string, hashed: string){ return cmp(plain, hashed); }

export function setSessionCookie(token: string){
  const jar = cookies();
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  jar.set('session', token, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60*60*24*7 });
}

export function clearSessionCookie(){
  const jar = cookies();
  const secure = String(process.env.COOKIE_SECURE||'false').toLowerCase() === 'true';
  jar.set('session', '', { httpOnly:true, sameSite:'lax', secure, path:'/', maxAge: 0 });
}

export async function getUserFromCookie(){
  const token = cookies().get('session')?.value;
  if (!token) return null;
  try{
    const dec: any = verify(token, SECRET);
    const user = await prisma.user.findUnique({ where: { id: dec.id } });
    return user;
  }catch{ return null; }
}

export async function requireAdmin(){
  const u = await getUserFromCookie();
  if (!u || u.role !== 'ADMIN') throw Object.assign(new Error('Forbidden'), { status: 403 });
  return u;
}
