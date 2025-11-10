'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Load Google Analytics script
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'GA_MEASUREMENT_ID', {
        page_title: document.title,
        page_location: window.location.href,
      });
    `;
    document.head.appendChild(script2);

    // Track page views
    const handleRouteChange = (url: string) => {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: url,
      });
    };

    // Initial page load
    handleRouteChange(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''));

    return () => {
      // Cleanup scripts on unmount
      document.head.removeChild(script1);
      document.head.removeChild(script2);
    };
  }, [pathname, searchParams]);

  // Track custom events
  useEffect(() => {
    // Track booking form interactions
    const handleBookingStart = () => {
      window.gtag('event', 'begin_checkout', {
        event_category: 'booking',
        event_label: 'booking_form_start',
      });
    };

    const handleBookingComplete = () => {
      window.gtag('event', 'purchase', {
        event_category: 'booking',
        event_label: 'booking_complete',
        value: 1, // You can pass the booking amount here
      });
    };

    // Listen for custom events
    window.addEventListener('booking_start', handleBookingStart);
    window.addEventListener('booking_complete', handleBookingComplete);

    return () => {
      window.removeEventListener('booking_start', handleBookingStart);
      window.removeEventListener('booking_complete', handleBookingComplete);
    };
  }, []);

  return null;
}