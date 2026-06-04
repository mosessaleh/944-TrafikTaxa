import { getUserFromCookie } from '@/lib/auth';
import AdminSidebar from './sidebar';
import { redirect } from 'next/navigation';
import { isStaffRole } from '@/lib/permissions';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getUserFromCookie();
  const isAdmin = !!me && me.type === 'user' && isStaffRole((me as any).role);

  if (!isAdmin) {
      redirect('/login');
   }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar role={(me as any).role} />
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-[95%] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
