import BookingPayTrigger from "@/app/_components/BookingPayTrigger";
import { confirmBookingAndGoToPay } from "@/app/_actions/booking-pay";
import { getCurrentUser } from '@/lib/session';
import BookClient from '@/components/book-client';
import ErrorBoundary from '@/components/error-boundary';
import type { Metadata } from 'next';

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
  return (
    <ErrorBoundary>
      <BookClient />
    </ErrorBoundary>
  );
}
