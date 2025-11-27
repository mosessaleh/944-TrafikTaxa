import { getUserFromCookie } from '@/lib/auth';
import AdminSidebar from './sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getUserFromCookie();
  const isAdmin = !!me && me.type === 'user' && (me as any).role === 'ADMIN';

  if (!isAdmin) {
      // If not admin, we just render children which will likely show the access denied message from page.tsx
      // or we could handle it here. The original layout rendered children regardless but conditionally rendered the nav.
      return <div className="min-h-screen bg-gray-50 p-4">{children}</div>;
   }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
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
