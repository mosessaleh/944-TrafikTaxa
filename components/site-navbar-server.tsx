import SiteNavbar, { type NavUser } from './site-navbar';
import { getUserFromCookie } from '@/lib/auth';

export default async function SiteNavbarServer(){
  const meFull = await getUserFromCookie().catch(() => null);
  const me: NavUser | null = meFull ? (
    meFull.type === 'partner' ? {
      id: Number(meFull.id),
      comUserName: String((meFull as any).comUserName || ''),
      comName: String((meFull as any).comName || ''),
      type: 'partner'
    } : {
      id: Number(meFull.id),
      firstName: String((meFull as any).firstName || ''),
      lastName: String((meFull as any).lastName || ''),
      email: String((meFull as any).email || ''),
      role: (meFull as any).role || 'USER',
      type: 'user'
    }
  ) : null;
  return <SiteNavbar me={me}/>;
}
