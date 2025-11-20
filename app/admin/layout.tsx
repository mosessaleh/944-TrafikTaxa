import Link from 'next/link';
import { getUserFromCookie } from '@/lib/auth';
import { getAdminPath } from '@/lib/admin-route';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  Car, 
  CreditCard, 
  Settings, 
  Bitcoin, 
  AlertTriangle, 
  Trash2,
  Bell
} from 'lucide-react';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getUserFromCookie();
  const isAdmin = !!me && me.role === 'ADMIN';

  if (!isAdmin) {
     // If not admin, we just render children which will likely show the access denied message from page.tsx
     // or we could handle it here. The original layout rendered children regardless but conditionally rendered the nav.
     return <div className="min-h-screen bg-gray-50 p-4">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm h-16 sticky top-0 z-30 border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Link href="/" className="font-bold text-xl text-gray-900 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">T</div>
                <span className="hidden md:inline tracking-tight">TrafikTaxa</span>
            </Link>
        </div>

        <div className="flex items-center gap-4">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="h-8 w-px bg-gray-200 mx-1"></div>
            <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                    <div className="text-sm font-semibold text-gray-900 leading-none">{me?.firstName} {me?.lastName}</div>
                    <div className="text-xs text-gray-500 mt-1">{me?.email}</div>
                </div>
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium shadow-sm text-sm">
                    {me?.firstName?.[0]}{me?.lastName?.[0]}
                </div>
            </div>
        </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-100 hidden lg:flex flex-col overflow-y-auto z-20">
            <nav className="p-4 space-y-1">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-2 px-3">Main Menu</div>
                
                <NavLink href={getAdminPath()} icon={<LayoutDashboard size={18} />} label="Dashboard" />
                <NavLink href={getAdminPath('/bookings')} icon={<ClipboardList size={18} />} label="Bookings" />
                <NavLink href={getAdminPath('/users')} icon={<Users size={18} />} label="Users" />
                <NavLink href={getAdminPath('/vehicles')} icon={<Car size={18} />} label="Vehicles" />
                <NavLink href={getAdminPath('/payments')} icon={<CreditCard size={18} />} label="Payments" />
                <NavLink href={getAdminPath('/crypto')} icon={<Bitcoin size={18} />} label="Crypto" />
                <NavLink href={getAdminPath('/complaints')} icon={<AlertTriangle size={18} />} label="Complaints" />
                
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-8 px-3">System</div>
                <NavLink href={getAdminPath('/settings')} icon={<Settings size={18} />} label="Settings" />
                <NavLink href={getAdminPath('/clear-data')} icon={<Trash2 size={18} />} label="Clear Data" variant="danger" />
            </nav>
            
            <div className="mt-auto p-4 border-t border-gray-100">
                <div className="bg-blue-50 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">Need Help?</h4>
                    <p className="text-xs text-blue-700 mb-3">Check the documentation for guide.</p>
                    <button className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg w-full transition-colors shadow-sm">
                        Documentation
                    </button>
                </div>
            </div>
        </aside>

        {/* Main Content */}
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

function NavLink({ href, icon, label, variant = 'default' }: { href: string, icon: React.ReactNode, label: string, variant?: 'default' | 'danger' }) {
    const baseClasses = "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group";
    const variantClasses = variant === 'danger' 
        ? "text-red-600 hover:bg-red-50 hover:shadow-sm" 
        : "text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm";

    return (
        <Link href={href} className={`${baseClasses} ${variantClasses}`}>
            <span className={variant === 'danger' ? "text-red-500" : "text-gray-400 group-hover:text-blue-500 transition-colors"}>
                {icon}
            </span>
            <span>{label}</span>
        </Link>
    );
}
