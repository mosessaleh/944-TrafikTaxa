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
  isDeveloper?: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get('session')?.value;
  if (!token) return null;
  try {
    const dec: any = verify(token, SECRET, {
      algorithms: ['HS256'], // Specify algorithm for security
    });

    // Additional validation: check if token has required fields
    if (!dec.id || typeof dec.id !== 'number') {
      return null;
    }

    // Check if token is expired (though verify should handle this, but explicit check)
    if (dec.exp && dec.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

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

    // Ensure user exists and is verified if required
    if (!u || !u.emailVerified) {
      return null;
    }

    // Auto-activate developer mode for admin users
    const isDeveloper = u.role === 'ADMIN';

    return { ...u, isDeveloper } as any;
  } catch (error: any) {
    // Log specific errors for debugging (in production, use proper logging)
    console.error('JWT validation error:', error.message);
    return null;
  }
}
