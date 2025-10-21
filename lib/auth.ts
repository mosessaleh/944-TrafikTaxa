import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const SECRET = process.env.SECRET || 'dev_secret_change_me';

export function signToken(payload: Record<string, any>){
  // صلاحية أسبوع
  return sign(payload, SECRET, { expiresIn: '7d' });
}

export async function hashPassword(password: string){
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(plain: string, hashed: string){
  return bcrypt.compare(plain, hashed);
}

// تُستخدم داخل مسارات API/صفحات السيرفر للحصول على المستخدم الحالي من كوكي session
export async function getUserFromCookie(){
  const token = cookies().get('session')?.value;
  if (!token) return null;
  try{
    const dec: any = verify(token, SECRET);
    const user = await prisma.user.findUnique({ where: { id: dec.id } });
    return user;
  }catch{
    return null;
  }
}
