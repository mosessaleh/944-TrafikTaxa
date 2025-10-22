import Link from 'next/link';

export default function Home(){
  return (
    <div className="grid gap-10">
      <section className="rounded-3xl border bg-white overflow-hidden">
        <div className="p-8 md:p-12 grid md:grid-cols-2 gap-8 items-center">
          <div className="grid gap-4">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Reliable taxi rides in Frederikssund</h1>
            <p className="text-slate-600">Book immediate or scheduled rides. Clear pricing day & night. Professional drivers — 24/7 support.</p>
            <div className="flex gap-3">
              <Link href="/book" className="px-5 py-3 rounded-2xl bg-black text-white">Book now</Link>
              <Link href="/history" className="px-5 py-3 rounded-2xl border">View history</Link>
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-yellow-200 to-yellow-400 h-48 md:h-64"/>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[{t:'Transparent pricing',d:'Day & night rates with distance and time calculation.'},{t:'Fast dispatch',d:'Immediate rides or schedule ahead with confirmations by email.'},{t:'Secure account',d:'Email verification, profile updates, and booking history.'}].map((c)=> (
          <div key={c.t} className="rounded-2xl border bg-white p-5">
            <div className="font-semibold">{c.t}</div>
            <div className="text-sm text-slate-600 mt-1">{c.d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
