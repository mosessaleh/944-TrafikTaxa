import dynamic from 'next/dynamic';
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';

// Lazy load analytics and monitoring
const GoogleAnalytics = dynamic(() => import('@/components/GoogleAnalytics'), {
  ssr: false,
});
const ErrorMonitoring = dynamic(() => import('@/components/ErrorMonitoring'), {
  ssr: false,
});
// Note: RealtimeProvider will be added later when WebSocket server is set up
// const RealtimeProvider = dynamic(() => import('@/components/RealtimeProvider'), {
//   ssr: false,
// });

// Lazy load heavy components
const GlobalBookingModalManager = dynamic(() => import("@/app/_components/GlobalBookingModalManager"), { ssr: false });
const BookingClientFallback = dynamic(() => import("@/app/_components/BookingClientFallback"), { ssr: false });
const BookingPayBridge = dynamic(() => import("@/app/_components/BookingPayBridge"), { ssr: false });
const BookingRedirector = dynamic(() => import("@/app/_components/BookingRedirector"), { ssr: false });
const SiteNavbarServer = dynamic(() => import('@/components/site-navbar-server'), { ssr: true });
const Toaster = dynamic(() => import('react-hot-toast').then(mod => ({ default: mod.Toaster })), { ssr: false });

export const metadata: Metadata = {
  title: {
    default: '944 Trafik - Premium Taxi Service in Frederikssund',
    template: '%s | 944 Trafik'
  },
  description: 'Experience luxury transportation with transparent pricing, professional drivers, and instant booking. 24/7 taxi service in Frederikssund, Copenhagen area. Book online now!',
  keywords: [
    'taxi Frederikssund',
    'taxi Copenhagen',
    'airport transfer Denmark',
    'professional taxi service',
    'luxury transportation',
    'taxi booking online',
    'taxi Denmark',
    'Frederikssund taxi',
    'Copenhagen taxi',
    'airport taxi Denmark',
    'taxi service 24/7',
    'reliable taxi Denmark'
  ],
  authors: [{ name: '944 Trafik', url: 'https://944-trafik.com' }],
  creator: '944 Trafik',
  publisher: '944 Trafik',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://944-trafik.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'da-DK': '/da',
      'ar': '/ar',
    },
  },
  openGraph: {
    title: '944 Trafik - Premium Taxi Service in Frederikssund',
    description: 'Experience luxury transportation with transparent pricing, professional drivers, and instant booking. 24/7 taxi service in Frederikssund, Copenhagen area.',
    url: 'https://944-trafik.com',
    siteName: '944 Trafik',
    images: [
      {
        url: '/logo.svg',
        width: 1200,
        height: 630,
        alt: '944 Trafik - Premium Taxi Service Logo',
        type: 'image/svg+xml',
      },
      {
        url: '/hero-944.png',
        width: 1200,
        height: 630,
        alt: '944 Trafik Taxi Service Hero Image',
        type: 'image/png',
      },
    ],
    locale: 'en_US',
    type: 'website',
    countryName: 'Denmark',
    emails: ['info@944-trafik.com'],
    phoneNumbers: ['+45 1234 5678'],
  },
  twitter: {
    card: 'summary_large_image',
    title: '944 Trafik - Premium Taxi Service',
    description: 'Experience luxury transportation with transparent pricing, professional drivers, and instant booking. 24/7 taxi service.',
    images: ['/logo.svg', '/hero-944.png'],
    creator: '@944trafik',
    site: '@944trafik',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
  category: 'Transportation',
  classification: 'Taxi Service',
  other: {
    'geo.region': 'DK-84', // Frederikssund region
    'geo.placename': 'Frederikssund, Denmark',
    'geo.position': '55.8396;12.0689',
    'ICBM': '55.8396, 12.0689',
    'DC.title': '944 Trafik - Premium Taxi Service',
    'DC.creator': '944 Trafik',
    'DC.subject': 'Taxi Service, Transportation, Frederikssund',
    'DC.description': 'Premium taxi service in Frederikssund with transparent pricing and professional drivers',
    'DC.publisher': '944 Trafik',
    'DC.type': 'Service',
    'DC.format': 'text/html',
    'DC.language': 'en',
  },
};

export default function RootLayout({ children }:{ children: React.ReactNode }){
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TaxiService",
    "name": "944 Trafik",
    "description": "Premium taxi service in Frederikssund with transparent pricing and professional drivers",
    "url": "https://944-trafik.com",
    "logo": "https://944-trafik.com/logo.svg",
    "image": "https://944-trafik.com/hero-944.png",
    "telephone": "+45-1234-5678",
    "email": "info@944-trafik.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Frederikssund",
      "addressLocality": "Frederikssund",
      "addressRegion": "Capital Region",
      "postalCode": "3600",
      "addressCountry": "DK"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "55.8396",
      "longitude": "12.0689"
    },
    "areaServed": [
      {
        "@type": "City",
        "name": "Frederikssund"
      },
      {
        "@type": "City",
        "name": "Copenhagen"
      }
    ],
    "serviceType": "Taxi Service",
    "provider": {
      "@type": "Organization",
      "name": "944 Trafik"
    },
    "priceRange": "$$",
    "paymentAccepted": ["Cash", "Credit Card", "Mobile Payment"],
    "currenciesAccepted": "DKK",
    "openingHours": "Mo-Su 00:00-23:59",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "500"
    },
    "sameAs": [
      "https://www.facebook.com/944trafik",
      "https://www.instagram.com/944trafik"
    ]
  };

  return (
    <html lang="en">
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-cyan-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>

        <Toaster />
        <GlobalBookingModalManager />
        <BookingClientFallback />
        <BookingPayBridge />
        <BookingRedirector />
        <SiteNavbarServer />
        <GoogleAnalytics />
        <ErrorMonitoring />
        {/* RealtimeProvider will be added when WebSocket server is configured */}

        {/* Page content in a centered container */}
        <main id="main-content" className="min-h-screen pt-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
