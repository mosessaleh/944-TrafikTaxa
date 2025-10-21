import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  const brand = process.env.BRAND_NAME || '944 Trafik';
  const city = process.env.CITY_NAME || 'Copenhagen';
  const addressCity = process.env.ADDRESS_CITY || 'Frederikssund';
  const email = process.env.CONTACT_EMAIL || 'trafik@944.dk';
  const phone = process.env.CONTACT_PHONE || '26444944';

  return (
    <div className="grid gap-10">
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">Fast, Reliable Taxi in {city}</h1>
          <p className="mt-4 text-gray-600">Book a ride with {brand}. Airport transfers, business rides, and daily commutes — on time, every time.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/book" className="px-5 py-3 rounded-2xl bg-black text-white">Book Now</Link>
            <Link href="/pricing" className="px-5 py-3 rounded-2xl border">View Pricing</Link>
          </div>
          <div className="mt-4 text-sm text-gray-600 flex flex-col gap-1">
            <div><span className="font-medium">HQ:</span> {addressCity}</div>
            <div><span className="font-medium">Email:</span> <a className="underline" href={`mailto:${email}`}>{email}</a></div>
            <div><span className="font-medium">Phone:</span> <a className="underline" href={`tel:${phone}`}>+45 {phone}</a></div>
          </div>
        </div>
        <div className="relative aspect-[16/10]">
          <Image src="/placeholder-hero.svg" alt="Taxi" fill className="object-cover rounded-2xl" />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        {[
          { title: 'Airport Rides', desc: 'Fixed-price airport transfers with meet & greet.' },
          { title: 'Business', desc: 'Invoice-ready rides for teams and events.' },
          { title: '24/7 Support', desc: 'We’re here around the clock for you.' },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-2xl bg-white shadow-sm border">
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-gray-600 mt-2 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="border rounded-2xl p-6 bg-white">
        <h2 className="text-xl font-semibold">Quick Contact</h2>
        <p className="text-gray-600 mt-1">Need a ride or a business quote? Reach us anytime.</p>
        <div className="mt-3 flex flex-col md:flex-row gap-3">
          <a href={`tel:${phone}`} className="px-4 py-2 rounded-xl border">Call: +45 {phone}</a>
          <a href={`mailto:${email}`} className="px-4 py-2 rounded-xl border">Email: {email}</a>
        </div>
      </section>
    </div>
  );
}
