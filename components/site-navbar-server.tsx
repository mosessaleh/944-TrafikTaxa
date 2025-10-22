import SiteNavbar, { type NavUser } from './site-navbar';
import { getCurrentUser } from '@/lib/session';

export default async function SiteNavbarServer(){
  // نحضر المستخدم من السيرفر لتفادي 401 على العميل
  const meFull = await getCurrentUser().catch(()=>null) as any;
  const me: NavUser = meFull ? { id: meFull.id, firstName: meFull.firstName, lastName: meFull.lastName, role: meFull.role } : null;
  return <SiteNavbar me={me}/>;
}
