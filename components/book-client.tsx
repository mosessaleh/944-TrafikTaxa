"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import AddressAutocomplete, { Suggestion } from '@/components/address-autocomplete';

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (<div className="grid gap-1"><div className="label">{label}</div>{children}</div>);
}

function formatDKK(n:number){
  try{ return new Intl.NumberFormat('en-DK',{ style:'currency', currency:'DKK', maximumFractionDigits:0 }).format(n); }
  catch{ return `${Math.round(n)} DKK`; }
}

type Vehicle = { id:number; key:string; title:string; capacity:number; multiplier:number };
enum FavApply { Pickup='pickup', Dropoff='dropoff' }
type FavItem = { id:number; label:string; address:string; lat:number|null; lon:number|null };
type Me = { id:number; firstName:string; lastName:string; email?:string; role?:string } | null;

export default function BookClient(){
  const { data: profileData } = useSWR('/api/profile', (url) =>
    fetch(url).then(r => r.json()).then(j => j?.me ? {
      id: j.me.id,
      firstName: j.me.firstName,
      lastName: j.me.lastName,
      email: j.me.email,
      role: j.me.role
    } : null)
  );
  const me = profileData || null;

  // Booking form state
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupSel, setPickupSel] = useState<Suggestion|null>(null);
  const [dropoffSel, setDropoffSel] = useState<Suggestion|null>(null);
  const [riderName, setRiderName] = useState('');
  const [vehicleId, setVehicleId] = useState<number|null>(null);
  const [whenType, setWhenType] = useState<'now'|'later'>('now');
  const [when, setWhen] = useState(() => new Date(Date.now()+15*60*1000).toISOString().slice(0,16));

  // Quote state
  const [quote, setQuote] = useState<{price:number; distanceKm:number; durationMin:number}|null>(null);
  const [qErr, setQErr] = useState<string|null>(null);
  const [qLoading, setQLoading] = useState(false);
  const qTimer = useRef<any>(null);

  // Booking state
  const [bookingLoading, setBookingLoading] = useState(false);

  // Favorites state
  const [saveModal, setSaveModal] = useState<{open:boolean; target: FavApply|null; name:string; address:string}>({open:false, target:null, name:'', address:''});
  const [pickModal, setPickModal] = useState<{open:boolean; target: FavApply|null}>({open:false, target:null});

  useEffect(() => {
    if(me) setRiderName(`${me.firstName} ${me.lastName}`.trim());
  }, [me]);

  const { data: vehicleData } = useSWR('/api/vehicle-types', (url) =>
    fetch(url).then(r => r.json()).then(j => j?.ok ? j.items || [] : [])
  );
  const vehicles = vehicleData || [];
  useEffect(() => {
    if (vehicles.length && vehicleId == null) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  const { data: favoritesData, error: favoritesError, mutate: mutateFavorites } = useSWR('/api/favorites', (url) =>
    fetch(url).then(r => r.status === 200 ? r.json().then(j => j?.ok ? j.items || [] : []) : [])
  );
  const favorites = favoritesData || [];

  const bothSelected = !!(pickupSel && dropoffSel);
  const quotePayload = useMemo(() => ({
    pickupAddress: pickupSel?.text || '',
    dropoffAddress: dropoffSel?.text || '',
    pickupLat: pickupSel?.lat ?? null,
    pickupLon: pickupSel?.lon ?? null,
    dropoffLat: dropoffSel?.lat ?? null,
    dropoffLon: dropoffSel?.lon ?? null,
    when: whenType === 'now' ? new Date().toISOString() : new Date(when).toISOString(),
    passengers: 1,
    vehicleTypeId: vehicleId || undefined
  }), [pickupSel, dropoffSel, whenType, when, vehicleId]);

  useEffect(() => {
    if(qTimer.current) clearTimeout(qTimer.current);
    const ready = bothSelected && !!vehicleId;
    if(!ready){ setQuote(null); setQErr(null); return; }

    qTimer.current = setTimeout(async() => {
      try{
        setQLoading(true);
        setQErr(null);
        const r = await fetch('/api/quote', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(quotePayload)
        });
        const j = await r.json();
        if(!r.ok || !j?.ok) throw new Error(j?.error||'Failed to get quote');
        setQuote({ price: j.price, distanceKm: j.distanceKm, durationMin: j.durationMin });
      }catch(e:any){
        setQuote(null);
        setQErr(e?.message||'Failed to get quote');
      } finally{
        setQLoading(false);
      }
    }, 200);
    return () => { if(qTimer.current) clearTimeout(qTimer.current); };
  }, [bothSelected, quotePayload, vehicleId]);

  async function handleBookAndPay(){
    if(!quote || !me) return;

    setBookingLoading(true);
    try{
      const bookingData = {
        riderName,
        passengers: 1,
        pickupAddress: quotePayload.pickupAddress,
        dropoffAddress: quotePayload.dropoffAddress,
        pickupLat: quotePayload.pickupLat,
        pickupLon: quotePayload.pickupLon,
        dropoffLat: quotePayload.dropoffLat,
        dropoffLon: quotePayload.dropoffLon,
        vehicleTypeId: vehicleId!,
        scheduled: whenType === 'later',
        pickupTime: whenType === 'later' ? new Date(when).toISOString() : new Date().toISOString(),
        amountDkk: quote.price
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      const bookingId = data.ride.id.toString();

      // Redirect to payment page with booking details
      const redirectUrl = `/pay?amount_dkk=${encodeURIComponent(quote.price.toString())}&booking_id=${encodeURIComponent(bookingId)}`;
      console.log("BookClient: Created booking and redirecting to payment", { bookingId, redirectUrl });
      window.location.href = redirectUrl;
    }catch(e:any){
      console.error("BookClient: Booking failed", e);
      alert(e?.message||'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  }



  // Favorites functions
  async function saveFavorite(){
    try{
      if(!saveModal.target) return;
      const addr = saveModal.address?.trim();
      if(!addr) return;
      const r = await fetch('/api/favorites',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          label: saveModal.name||'Favorite',
          address: addr,
          lat: (saveModal.target===FavApply.Pickup? pickupSel?.lat: dropoffSel?.lat)??null,
          lon: (saveModal.target===FavApply.Pickup? pickupSel?.lon: dropoffSel?.lon)??null
        })
      });
      const j = await r.json();
      if(j?.ok){
        mutateFavorites();
        setSaveModal({open:false,target:null,name:'',address:''});
      }
    }catch(e){
      // ignore
    }
  }

  function applyFav(f:FavItem, to:FavApply){
    const s: Suggestion = { id: null, text: f.address, lat: f.lat, lon: f.lon, postcode:null, city:null };
    if(to===FavApply.Pickup){
      setPickupSel(s);
      setPickup(s.text);
    } else {
      setDropoffSel(s);
      setDropoff(s.text);
    }
    setPickModal({ open:false, target:null });
  }

  const Star = ({onClick}:{onClick:()=>void}) => (
    <button type="button" onClick={onClick} title="Save to favorites" aria-label="Save to favorites" className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border bg-white hover:bg-gray-50 active:scale-[.98] transition">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M11.48 3.499a.75.75 0 0 1 1.04 0l2.644 2.58 3.532.514a.75.75 0 0 1 .416 1.279l-2.556 2.49.604 3.52a.75.75 0 0 1-1.088.79L12 13.97l-3.172 1.673a.75.75 0 0 1-1.088-.79l.604-3.52-2.556-2.49a.75.75 0 0 1 .416-1.279l3.532-.514 2.644-2.58Z"/>
      </svg>
    </button>
  );


  return (
    <>
      <div className="grid gap-8">


      {!me && (
        <div className="card-feature border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
          <div className="text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-lg font-semibold text-amber-800 mb-2">Login Required</h3>
            <p className="text-amber-700">You must be logged in to book a ride. Please sign in to continue.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="card">
          <div className="card-body">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <span>📍</span>
                Trip Details
              </h2>
            </div>

            <div className="grid gap-4 md:gap-6">
              {/* Pickup Address */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="text-green-600">🚀</span>
                  Pickup Address
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <AddressAutocomplete
                      label=""
                      name="pickup"
                      value={pickup}
                      onChange={v => { setPickup(v); setPickupSel(null); }}
                      onSelect={s => { setPickupSel(s); setPickup(s.text); }}
                    />
                  </div>
                  {pickupSel && (
                    <Star onClick={()=> setSaveModal({ open:true, target: FavApply.Pickup, name:'', address: pickupSel?.text||'' })} />
                  )}
                </div>
                <button type="button" onClick={()=> setPickModal({ open:true, target: FavApply.Pickup })} className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors flex items-center gap-1">
                  <span>⭐</span>
                </button>
              </div>

              {/* Dropoff Address */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="text-red-600">🎯</span>
                  Dropoff Address
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <AddressAutocomplete
                      label=""
                      name="dropoff"
                      value={dropoff}
                      onChange={v => { setDropoff(v); setDropoffSel(null); }}
                      onSelect={s => { setDropoffSel(s); setDropoff(s.text); }}
                    />
                  </div>
                  {dropoffSel && (
                    <Star onClick={()=> setSaveModal({ open:true, target: FavApply.Dropoff, name:'', address: dropoffSel?.text||'' })} />
                  )}
                </div>
                <button type="button" onClick={()=> setPickModal({ open:true, target: FavApply.Dropoff })} className="text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors flex items-center gap-1">
                  <span>⭐</span>
                </button>
              </div>

              {/* Vehicle and Passenger Details */}
              <div className="grid gap-4 md:gap-6">
                <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="text-purple-600">🚙</span>
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleId ?? ''}
                      onChange={e => setVehicleId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200 hover:shadow-md"
                    >
                      {vehicles.map((v: Vehicle) => (
                        <option key={v.id} value={v.id}>{v.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="text-blue-600">👤</span>
                      Passenger Name
                    </label>
                    <input
                      value={riderName}
                      onChange={e => setRiderName(e.target.value)}
                      placeholder="Enter passenger name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200 hover:shadow-md"
                    />
                  </div>
                </div>

                {/* Time Selection */}
                <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="text-indigo-600">🕐</span>
                      When to Pickup
                    </label>
                    <select
                      value={whenType}
                      onChange={e => setWhenType(e.target.value as 'now'|'later')}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200 hover:shadow-md"
                    >
                      <option value="now">🚀 Immediate pickup</option>
                      <option value="later">📅 Schedule for later</option>
                    </select>
                  </div>
                  {whenType === 'later' && (
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <span className="text-emerald-600">📆</span>
                        Pickup Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={when}
                        onChange={e => setWhen(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-200 hover:shadow-md"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Book Button */}
              <div className="pt-4 md:pt-6 border-t border-slate-200">
                <div className="flex flex-col gap-4">
                  <div className="text-sm text-slate-600">
                    {!me && <span className="flex items-center gap-1 text-amber-600"><span>⚠️</span> Login required to book</span>}
                    {me && quote && <span className="flex items-center gap-1 text-emerald-600"><span>✅</span> Ready to book</span>}
                  </div>
                  <button
                    onClick={() => {
                      console.log("Book and Pay clicked", { me: !!me, quote: !!quote, qLoading, bothSelected, vehicleId });
                      handleBookAndPay();
                    }}
                    disabled={!me || !quote || qLoading || !bothSelected || !vehicleId || bookingLoading}
                    className={`w-full px-6 py-4 rounded-2xl font-semibold text-base md:text-lg transition-all duration-200 flex items-center justify-center gap-2 min-h-[48px] ${
                      !me || !quote || qLoading || !bothSelected || !vehicleId || bookingLoading
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'btn-primary shadow-xl hover:shadow-2xl transform hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                  >
                    {bookingLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Creating Booking...
                      </>
                    ) : (
                      <>
                        <span>💳</span>
                        Book and Pay
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-feature bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border-emerald-200">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-xl md:text-2xl">💰</span>
            </div>
            <div className="text-sm font-medium text-emerald-700 mb-2">Estimated Price</div>
            <div className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-3">
              {quote ? formatDKK(quote.price) : formatDKK(0)}
            </div>
            <div className="text-slate-600">
              {quote ? (
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <span>📍</span>
                    ~{quote.distanceKm?.toFixed?.(2)} km
                  </span>
                  <span className="flex items-center gap-1">
                    <span>⏱️</span>
                    ~{quote.durationMin} min
                  </span>
                </div>
              ) : (
                <div className="text-slate-500">Select pickup & dropoff addresses to get a quote</div>
              )}
              {qLoading && (
                <div className="flex items-center justify-center gap-2 mt-2 text-cyan-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-600 border-t-transparent"></div>
                  Calculating price...
                </div>
              )}
            </div>
            {qErr && (
              <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                ⚠️ {qErr}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Save Favorite Modal */}
      {saveModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="grid gap-3">
              <h3 className="text-lg font-semibold">Save to favorites</h3>
              <Field label="Label">
                <input
                  value={saveModal.name}
                  onChange={e=> setSaveModal(s=> ({...s, name: e.target.value}))}
                  placeholder="e.g. Home, Work"
                  className="input"
                />
              </Field>
              <Field label="Address">
                <input
                  value={saveModal.address}
                  onChange={e=> setSaveModal(s=> ({...s, address: e.target.value}))}
                  className="input"
                />
              </Field>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={()=> setSaveModal({open:false,target:null,name:'',address:''})}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button onClick={saveFavorite} className="btn-primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pick Favorite Modal */}
      {pickModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-4 md:p-6 max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="grid gap-3">
              <h3 className="text-lg font-semibold">Choose from favorites</h3>
              <div className="max-h-80 overflow-y-auto">
                {favorites.length===0 && (
                  <div className="text-sm text-gray-600">
                    No favorites yet. Select an address and use the star to save it.
                  </div>
                )}
                {favorites.length>0 && (
                  <ul className="divide-y">
                    {favorites.map((f:FavItem)=> (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={()=> applyFav(f, pickModal.target as FavApply)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="font-medium text-sm">{f.label}</div>
                          <div className="text-xs text-gray-600">{f.address}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={()=> setPickModal({open:false, target:null})}
                  className="btn-ghost"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
