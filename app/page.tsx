import Link from 'next/link';

export default function Home(){
  return (
    <div className="grid gap-16 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20"></div>
        <div className="relative p-6 md:p-16 grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="grid gap-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-sm font-medium">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
              24/7 Available
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Premium Taxi Service in Frederikssund
            </h1>
            <p className="text-slate-300 text-base md:text-lg leading-relaxed">
              Experience luxury transportation with transparent pricing, professional drivers, and instant booking. Your journey starts here.
            </p>
            <div className="flex flex-col gap-4">
              <Link href="/book" className="btn-primary text-center px-8 py-4 text-lg font-semibold">
                🚗 Book Your Ride
              </Link>
              <Link href="/pricing" className="btn-ghost text-center px-8 py-4 text-lg font-semibold bg-white/10 border-white/20 text-white hover:bg-white/20">
                📊 View Pricing
              </Link>
            </div>
          </div>
          <div className="relative mt-8 md:mt-0">
            <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 h-48 md:h-64 lg:h-80 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500"></div>
            <div className="absolute -top-2 -right-2 md:-top-4 md:-right-4 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl shadow-xl animate-bounce"></div>
            <div className="absolute -bottom-2 -left-2 md:-bottom-4 md:-left-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
        {[
          {
            icon: '💰',
            title: 'Transparent Pricing',
            desc: 'Clear day & night rates with real-time distance and time calculation. No hidden fees.',
            color: 'from-emerald-500 to-teal-600'
          },
          {
            icon: '⚡',
            title: 'Lightning Fast',
            desc: 'Book immediate rides or schedule ahead. Get instant confirmations and driver details.',
            color: 'from-cyan-500 to-blue-600'
          },
          {
            icon: '🛡️',
            title: 'Secure & Reliable',
            desc: 'Verified drivers, secure payments, and 24/7 customer support for peace of mind.',
            color: 'from-purple-500 to-pink-600'
          }
        ].map((feature, i) => (
          <div key={feature.title} className="card-feature group">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} text-white text-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl md:rounded-3xl p-6 md:p-12">
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 mb-4">Trusted by Thousands</h2>
          <p className="text-slate-600 text-base md:text-lg">Join our growing community of satisfied customers</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
          {[
            { number: '10K+', label: 'Happy Riders' },
            { number: '500+', label: 'Professional Drivers' },
            { number: '4.9★', label: 'Average Rating' },
            { number: '24/7', label: 'Customer Support' }
          ].map((stat) => (
            <div key={stat.label} className="group">
              <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">
                {stat.number}
              </div>
              <div className="text-slate-600 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl md:rounded-3xl p-6 md:p-12 text-white">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4">Ready for Your Next Journey?</h2>
        <p className="text-cyan-100 text-base md:text-lg mb-6 md:mb-8 max-w-2xl mx-auto">
          Experience the difference with 944 Trafik. Professional service, competitive pricing, and unforgettable rides.
        </p>
        <div className="flex flex-col gap-4 justify-center">
          <Link href="/book" className="btn-secondary px-8 py-4 text-lg font-semibold">
            🚀 Start Booking Now
          </Link>
          <Link href="/contact" className="btn-ghost px-8 py-4 text-lg font-semibold bg-white/10 border-white/20 text-white hover:bg-white/20">
            📞 Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
