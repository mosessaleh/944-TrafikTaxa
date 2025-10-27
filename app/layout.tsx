import GlobalBookingModalManager from "@/app/_components/GlobalBookingModalManager";
import BookingClientFallback from "@/app/_components/BookingClientFallback";
import BookingPayBridge from "@/app/_components/BookingPayBridge";
import BookingRedirector from "@/app/_components/BookingRedirector";
import './globals.css';
import type { Metadata } from 'next';
import SiteNavbarServer from '@/components/site-navbar-server';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = { title: '944 Trafik', description: 'Taxi booking' };

export default function RootLayout({ children }:{ children: React.ReactNode }){
  return (
    <html lang="en">
      <body>
        <Toaster />
        <GlobalBookingModalManager />
        <BookingClientFallback />
       <BookingPayBridge />
        <BookingRedirector />
        <SiteNavbarServer />
        {/* Page content in a centered container */}
        <main className="min-h-screen pt-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
