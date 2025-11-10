import dynamic from 'next/dynamic';
import BookingPayTrigger from "@/app/_components/BookingPayTrigger";
import { confirmBookingAndGoToPay } from "@/app/_actions/booking-pay";
import { getUserFromCookie } from '@/lib/auth';
import ErrorBoundary from '@/components/error-boundary';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

const BookClient = dynamic(() => import('@/components/book-client'), {
  loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div></div>
});

export const metadata: Metadata = {
  title: 'Book Your Taxi Ride | 944 Trafik',
  description: 'Book a taxi with 944 Trafik. Reliable transportation in Copenhagen and beyond.',
  openGraph: {
    title: 'Book Your Taxi Ride | 944 Trafik',
    description: 'Book a taxi with 944 Trafik. Reliable transportation in Copenhagen and beyond.',
    images: [{ url: '/logo.svg' }],
  },
};

export default async function BookPage(){
  const user = await getUserFromCookie();
  if (!user) {
    redirect('/login?redirect=/book');
  }

  return (
    <ErrorBoundary>
      <BookClient />
    </ErrorBoundary>
  );
}
