'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';
import Script from 'next/script';

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
    // Track page views
    const handleRouteChange = (url: string) => {
      if (window.gtag) {
        window.gtag('config', 'GA_MEASUREMENT_ID', {
          page_path: url,
        });
      }
    };

    // Initial page load
    handleRouteChange(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''));
  }, [pathname, searchParams]);

  // Track custom events
  useEffect(() => {
    // Track booking form interactions
    const handleBookingStart = () => {
      if (window.gtag) {
        window.gtag('event', 'begin_checkout', {
          event_category: 'booking',
          event_label: 'booking_form_start',
        });
      }
    };

    const handleBookingComplete = () => {
      if (window.gtag) {
        window.gtag('event', 'purchase', {
          event_category: 'booking',
          event_label: 'booking_complete',
          value: 1, // You can pass the booking amount here
        });
      }
    };

    // Listen for custom events
    window.addEventListener('booking_start', handleBookingStart);
    window.addEventListener('booking_complete', handleBookingComplete);

    return () => {
      window.removeEventListener('booking_start', handleBookingStart);
      window.removeEventListener('booking_complete', handleBookingComplete);
    };
  }, []);

  // Track Web Vitals
  useEffect(() => {
    const sendToGoogleAnalytics = ({ name, delta, value, id }: any) => {
      if (window.gtag) {
        window.gtag('event', name, {
          event_category: 'Web Vitals',
          event_label: id,
          value: Math.round(name === 'CLS' ? delta * 1000 : delta),
          custom_map: { metric_value: value },
          non_interaction: true,
        });
      }
    };

    onCLS(sendToGoogleAnalytics);
    onFCP(sendToGoogleAnalytics);
    onLCP(sendToGoogleAnalytics);
    onTTFB(sendToGoogleAnalytics);
    onINP(sendToGoogleAnalytics);
  }, []);

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'GA_MEASUREMENT_ID', {
            page_title: document.title,
            page_location: window.location.href,
          });
        `}
      </Script>
    </>
  );
}