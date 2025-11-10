import Link from 'next/link';
import Image from 'next/image';
import { NavLinks, AuthButtons } from '@/components/nav-auth-client';

export default function Navbar(){
  return (
    <header className="bg-white/90 backdrop-blur border-b mb-[10px] p-[5px]">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="944 Trafik" width={180} height={40} priority className="h-10 w-auto"/>
          </Link>
          <nav className="hidden md:block"><NavLinks /></nav>
        </div>
        <div className="flex items-center gap-3">
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
