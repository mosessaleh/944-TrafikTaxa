import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteNavbarServer from '@/components/site-navbar-server';

export const metadata: Metadata = {
  title: '944 Trafik',
  description: 'Taxi booking'
};

export default function RootLayout({ children }: { children: ReactNode }){
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <SiteNavbarServer />
        <main id="main-content" className="min-h-screen pt-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
