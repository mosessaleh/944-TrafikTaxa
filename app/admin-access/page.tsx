import { redirect } from 'next/navigation';
import { getUserFromCookie } from '@/lib/auth';
import { getAdminPath } from '@/lib/admin-route';

type AdminAccessPageProps = {
  searchParams?: {
    next?: string;
  };
};

const normalizeNextPath = (value?: string) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '';
  }

  return value;
};

export default async function AdminAccessPage({ searchParams }: AdminAccessPageProps) {
  const user = await getUserFromCookie();
  if (!user || user.type !== 'user' || (user as any).role !== 'ADMIN') {
    redirect('/login');
  }

  redirect(getAdminPath(normalizeNextPath(searchParams?.next)));
}
