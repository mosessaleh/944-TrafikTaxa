import SiteNavbar, { type NavUser } from './site-navbar';
import { getUserFromCookie } from '@/lib/auth';

export default async function SiteNavbarServer(){
  const meFull = await getUserFromCookie().catch(() => null);
  const me: NavUser | null = meFull ? {
    id: Number(meFull.id),
    firstName: String(meFull.firstName || ''),
    lastName: String(meFull.lastName || ''),
    role: (meFull as any).role || 'USER'
  } : null;
  return <SiteNavbar me={me}/>;
}
