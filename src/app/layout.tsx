import '../globals.css';
import type { Metadata } from 'next';
import SiteNavbarServer from '@/components/site-navbar-server';

export const metadata: Metadata = { title: '944 Trafik', description: 'Taxi booking' };

export default function RootLayout({ children }:{ children: React.ReactNode }){
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <SiteNavbarServer />
        <main className="min-h-screen">
          <div className="mx-auto max-w-6xl px-4">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
