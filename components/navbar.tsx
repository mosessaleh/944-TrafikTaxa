import Link from 'next/link';
import { NavLinks, AuthButtons } from '@/components/nav-auth-client';

export default function Navbar(){
  return (
    <header className="border-b bg-white">
      <div className="container py-3 flex items-center justify-between">
        {/* Left: logo + links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">944 Trafik</Link>
          <NavLinks />
        </div>
        {/* Right: auth buttons */}
        <AuthButtons />
      </div>
    </header>
  );
}
