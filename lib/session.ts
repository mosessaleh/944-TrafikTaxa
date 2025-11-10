import { cookies } from 'next/headers';

export type CurrentUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  pendingEmail?: string | null;
};

/**
 * Lightweight server-side session reader.
 *
 * It expects a cookie named "me" that contains a URL-encoded JSON object like:
 * { id, email, firstName, lastName, role, emailVerified }
 * If absent or invalid, returns null.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const raw = cookies().get('me')?.value;
    if (!raw) return null;

    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== 'object') return null;

    const user: CurrentUser = {
      id: Number(parsed.id) || 0,
      email: String(parsed.email || ''),
      firstName: String(parsed.firstName || ''),
      lastName: String(parsed.lastName || ''),
      phone: String(parsed.phone || ''),
      address: String(parsed.address || ''),
      role: parsed.role === 'ADMIN' ? 'ADMIN' : 'USER',
      emailVerified: !!parsed.emailVerified,
      pendingEmail: parsed.pendingEmail || null,
    };

    if (!user.id || !user.email) return null;
    return user;
  } catch {
    return null;
  }
}
