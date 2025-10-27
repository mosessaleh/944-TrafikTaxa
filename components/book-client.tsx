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
    <div className="container-page grid gap-6">
      <h1>Book a ride</h1>

      {!me && (
        <div className="card">
          <div className="card-body bg-yellow-50 border-yellow-200 text-yellow-900 text-sm">
            You must be logged in to book.
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body flex items-end justify-between">
          <div className="grid gap-1">
            <div className="strip">Estimated price</div>
            <div className="text-5xl font-extrabold leading-none">
              {quote ? formatDKK(quote.price) : formatDKK(0)}
            </div>
            <div className="text-xs text-gray-500">
              {quote ? (
                <>~{quote.distanceKm?.toFixed?.(2)} km • ~{quote.durationMin} min</>
              ) : (
                <>Select pickup & dropoff from the list, then choose vehicle type</>
              )}
              {qLoading && <span className="ml-2 text-gray-400">(calculating…)</span>}
            </div>
            {qErr && <div className="text-xs text-red-600">{qErr}</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body grid gap-4">
          <div className="grid gap-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <AddressAutocomplete
                  label="Pickup address"
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
            <button type="button" onClick={()=> setPickModal({ open:true, target: FavApply.Pickup })} className="text-xs text-gray-600 underline w-fit">
              Choose from favorites
            </button>
          </div>

          <div className="grid gap-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <AddressAutocomplete
                  label="Dropoff address"
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
            <button type="button" onClick={()=> setPickModal({ open:true, target: FavApply.Dropoff })} className="text-xs text-gray-600 underline w-fit">
              Choose from favorites
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Vehicle type">
              <select
                value={vehicleId ?? ''}
                onChange={e => setVehicleId(e.target.value ? Number(e.target.value) : null)}
                className="select"
              >
                {vehicles.map((v: Vehicle) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Ride for (name)">
              <input
                value={riderName}
                onChange={e => setRiderName(e.target.value)}
                className="input"
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="When">
              <select
                value={whenType}
                onChange={e => setWhenType(e.target.value as 'now'|'later')}
                className="select"
              >
                <option value="now">Immediate</option>
                <option value="later">Schedule for later</option>
              </select>
            </Field>
            {whenType === 'later' && (
              <Field label="Pickup time">
                <input
                  type="datetime-local"
                  value={when}
                  onChange={e => setWhen(e.target.value)}
                  className="input"
                />
              </Field>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                console.log("Book and Pay clicked", { me: !!me, quote: !!quote, qLoading, bothSelected, vehicleId });
                handleBookAndPay();
              }}
              disabled={!me || !quote || qLoading || !bothSelected || !vehicleId || bookingLoading}
              className={!me || !quote || qLoading || !bothSelected || !vehicleId || bookingLoading ?
                'btn-muted' : 'btn-primary'}
            >
              {bookingLoading ? 'Creating Booking...' : 'Book and Pay'}
            </button>
            {!me && <span className="text-sm text-gray-500">Login required</span>}
          </div>
        </div>
      </div>

      {/* Save Favorite Modal */}
      {saveModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6" onClick={e=>e.stopPropagation()}>
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
          <div className="w-full max-w-md rounded-2xl border bg-white p-6" onClick={e=>e.stopPropagation()}>
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
    </div>
  );
}
