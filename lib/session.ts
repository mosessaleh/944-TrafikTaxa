import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/db';

const SECRET = process.env.SECRET || 'change_me_dev_secret';

export type CurrentUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  pendingEmail?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get('session')?.value;
  if (!token) return null;
  try {
    const dec: any = verify(token, SECRET);
    const u = await prisma.user.findUnique({
      where: { id: dec.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        street: true,
        houseNumber: true,
        postalCode: true,
        city: true,
        role: true,
        emailVerified: true,
        pendingEmail: true,
      }
    });
    return u as any;
  } catch {
    return null;
  }
}
