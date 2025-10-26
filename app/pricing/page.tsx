import { formatCurrency } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Taxi Pricing | 944 Trafik',
  description: 'Transparent pricing for taxi services. View our fixed rates for city rides, airport transfers, and business travel.',
  openGraph: {
    title: 'Taxi Pricing | 944 Trafik',
    description: 'Transparent pricing for taxi services. View our fixed rates for city rides, airport transfers, and business travel.',
    images: [{ url: '/logo.svg' }],
  },
};

const PRICING = [
  { name: 'City Ride', price: 129, features: ['Up to 5 km', 'Standard sedan', 'Up to 4 passengers'] },
  { name: 'Airport', price: 299, features: ['Copenhagen Airport', 'Meet & Greet', 'Flight tracking'] },
  { name: 'Business', price: 399, features: ['Priority pickup', 'Invoice', 'Premium vehicles'] },
];

export default function PricingPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="text-gray-600 mt-2">Transparent, fixed prices for popular routes.</p>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        {PRICING.map((p) => (
          <div key={p.name} className="bg-white border rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-lg">{p.name}</h3>
            <div className="text-3xl font-bold mt-2">{formatCurrency(p.price)}</div>
            <ul className="mt-4 text-sm text-gray-600 list-disc list-inside">
              {p.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
