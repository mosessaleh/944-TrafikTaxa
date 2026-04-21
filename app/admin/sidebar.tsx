'use client';

import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useState } from 'react';
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
  Bell,
  Shield,
  Eye,
  Building,
  ChevronDown,
  Menu,
  FileText,
  MapPin
} from 'lucide-react';

export default function AdminSidebar() {
  const [generalExpanded, setGeneralExpanded] = useState(false);
  const [partnersExpanded, setPartnersExpanded] = useState(false);
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
        >
          <Menu size={24} className="text-gray-600" />
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`w-64 bg-white border-r border-gray-100 flex-col overflow-y-auto z-40 ${mobileMenuOpen ? 'fixed top-16 left-0 bottom-0 lg:flex' : 'hidden lg:flex'}`}>
      <nav className="p-4 space-y-1">
        <button
          onClick={() => setGeneralExpanded(!generalExpanded)}
          className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-2 px-3 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <span>General</span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${generalExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${generalExpanded ? 'max-h-[60vh] opacity-100 overflow-y-auto pr-1' : 'max-h-0 opacity-0'}`}>
          <NavLink href={getAdminPath()} icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavLink href={getAdminPath('/bookings')} icon={<ClipboardList size={18} />} label="Bookings" />
          <NavLink href={getAdminPath('/news')} icon={<Bell size={18} />} label="Company News" />
          <NavLink href={getAdminPath('/users')} icon={<Users size={18} />} label="Users" />
          <NavLink href={getAdminPath('/vehicles')} icon={<Car size={18} />} label="Vehicles" />
          <NavLink href={getAdminPath('/map')} icon={<MapPin size={18} />} label="Map" />
          <NavLink href={getAdminPath('/payments')} icon={<CreditCard size={18} />} label="Payments" />
          <NavLink href={getAdminPath('/invoices')} icon={<FileText size={18} />} label="Invoices" />
          <NavLink href={getAdminPath('/crypto')} icon={<Bitcoin size={18} />} label="Crypto" />
          <NavLink href={getAdminPath('/complaints')} icon={<AlertTriangle size={18} />} label="Complaints" />
          <NavLink href={getAdminPath('/risk')} icon={<Shield size={18} />} label="Risk Management" />
        </div>

        <button
          onClick={() => setPartnersExpanded(!partnersExpanded)}
          className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-8 px-3 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <span>Partners</span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${partnersExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${partnersExpanded ? 'max-h-[50vh] opacity-100 overflow-y-auto pr-1' : 'max-h-0 opacity-0'}`}>
          <NavLink href={getAdminPath('/partners/overview')} icon={<Eye size={18} />} label="Overview" />
          <NavLink href={getAdminPath('/partners/companies')} icon={<Building size={18} />} label="Companies" />
          <NavLink href={getAdminPath('/partners/drivers')} icon={<Users size={18} />} label="Drivers" />
          <NavLink href={getAdminPath('/partners/vehicles')} icon={<Car size={18} />} label="Vehicles" />
        </div>

        <button
          onClick={() => setSystemExpanded(!systemExpanded)}
          className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-8 px-3 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <span>System</span>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${systemExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${systemExpanded ? 'max-h-[40vh] opacity-100 overflow-y-auto pr-1' : 'max-h-0 opacity-0'}`}>
          <NavLink href={getAdminPath('/settings')} icon={<Settings size={18} />} label="Settings" />
          <NavLink href={getAdminPath('/clear-data')} icon={<Trash2 size={18} />} label="Clear Data" variant="danger" />
        </div>
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
    </>
  );
}

function NavLink({ href, icon, label, variant = 'default' }: { href: string, icon: ReactNode, label: string, variant?: 'default' | 'danger' }) {
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
