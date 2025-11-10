import { formatCurrency } from '@/lib/utils';
import { prisma } from '@/lib/db';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Taxi Pricing | 944 Trafik',
  description: 'Transparent pricing for taxi services based on distance, time, and vehicle type.',
  openGraph: {
    title: 'Taxi Pricing | 944 Trafik',
    description: 'Transparent pricing for taxi services based on distance, time, and vehicle type.',
    images: [{ url: '/logo.svg' }],
  },
};

async function getData() {
  const settings = await prisma.settings.findFirst();
  const vehicles = await prisma.vehicleType.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  return { settings, vehicles };
}

export default async function PricingPage() {
  const { settings, vehicles } = await getData();

  if (!settings) {
    return <div>Settings not found</div>;
  }

  const calculatePrice = (base: number, perKm: number, perMin: number, multiplier: number, km: number, min: number) => {
    return Math.round((base + km * perKm + min * perMin) * multiplier);
  };

  const exampleKm = 10;
  const exampleMin = 12;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            🚕 Pricing Guide
          </h1>
          <p className="text-gray-600 mt-4 text-lg">Transparent pricing based on distance, time, and vehicle type</p>
        </div>

        {/* Base Rates */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">📊 Base Rates</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl p-8 shadow-xl text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">☀️</div>
                <h3 className="font-bold text-xl mb-4">Regular Day</h3>
                <p className="text-yellow-100 mb-2">(06:00 - 18:00)</p>
                <div className="space-y-3 text-lg">
                  <div className="flex justify-between">
                    <span>Starting Price:</span>
                    <span className="font-bold">{formatCurrency(settings.dayBase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Kilometer:</span>
                    <span className="font-bold">{formatCurrency(settings.dayPerKm)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Minute:</span>
                    <span className="font-bold">{formatCurrency(settings.dayPerMin)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 shadow-xl text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">🌙</div>
                <h3 className="font-bold text-xl mb-4">Evening & Holidays</h3>
                <p className="text-indigo-200 mb-2">(18:00 - 06:00 & Holidays)</p>
                <div className="space-y-3 text-lg">
                  <div className="flex justify-between">
                    <span>Starting Price:</span>
                    <span className="font-bold">{formatCurrency(settings.nightBase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Kilometer:</span>
                    <span className="font-bold">{formatCurrency(settings.nightPerKm)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Minute:</span>
                    <span className="font-bold">{formatCurrency(settings.nightPerMin)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 shadow-xl text-white">
              <div className="text-center">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="font-bold text-xl mb-4">Example Trip</h3>
                <p className="text-emerald-100 mb-6">Sample calculation for reference</p>
                <div className="bg-white/20 rounded-2xl p-4">
                  <p className="text-lg font-semibold">{exampleKm} km trip</p>
                  <p className="text-lg font-semibold">{exampleMin} minutes duration</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Examples */}
        <div>
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">🚗 Vehicle Types & Examples</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {vehicles.map((v: any, index: number) => {
              const gradients = [
                'from-red-500 to-pink-500',
                'from-blue-500 to-cyan-500',
                'from-green-500 to-emerald-500',
                'from-purple-500 to-indigo-500',
                'from-orange-500 to-yellow-500',
                'from-teal-500 to-blue-500'
              ];
              const icons = ['🚕', '🚙', '🚐', '🚗', '🚌', '🚛'];
              return (
                <div key={v.id} className={`bg-gradient-to-br ${gradients[index % gradients.length]} rounded-3xl p-8 shadow-xl text-white hover:scale-105 transition-transform duration-300`}>
                  <div className="text-center">
                    <div className="text-5xl mb-4">{icons[index % icons.length]}</div>
                    <h3 className="font-bold text-xl mb-2">{v.title}</h3>
                    <p className="text-sm opacity-90 mb-6">Up to {v.capacity} passengers</p>
                    <div className="bg-white/20 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Day Rate:</span>
                        <span className="font-bold text-lg">{formatCurrency(calculatePrice(settings.dayBase, settings.dayPerKm, settings.dayPerMin, v.multiplier, exampleKm, exampleMin))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Evening/Holiday:</span>
                        <span className="font-bold text-lg">{formatCurrency(calculatePrice(settings.nightBase, settings.nightPerKm, settings.nightPerMin, v.multiplier, exampleKm, exampleMin))}</span>
                      </div>
                    </div>
                    <p className="text-xs opacity-75 mt-4">For {exampleKm}km + {exampleMin}min trip</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
