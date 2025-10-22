"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import AddressAutocomplete, { Suggestion } from '@/components/address-autocomplete';

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <div className="text-sm text-gray-700">{label}</div>
      {children}
    </div>
  );
}

function formatDKK(n:number){
  try{ return new Intl.NumberFormat('en-DK',{ style:'currency', currency:'DKK', maximumFractionDigits:0 }).format(n); }
  catch{ return `${Math.round(n)} DKK`; }
}

type Vehicle = { id:number; key:string; title:string; capacity:number; multiplier:number };

enum FavApply { Pickup='pickup', Dropoff='dropoff' }

export default function BookClient({ me }:{ me:any }){
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupSel, setPickupSel] = useState<Suggestion|null>(null);
  const [dropoffSel, setDropoffSel] = useState<Suggestion|null>(null);
  const [riderName, setRiderName] = useState(me? `${me.firstName} ${me.lastName}` : '');
  const [vehicleId, setVehicleId] = useState<number| null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [whenType, setWhenType] = useState<'now'|'later'>('now');
  const [when, setWhen] = useState(()=> new Date(Date.now()+15*60*1000).toISOString().slice(0,16));

  // Quote state
  const [quote, setQuote] = useState<{price:number; distanceKm:number; durationMin:number} | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [qLoading, setQLoading] = useState(false);
  const qTimer = useRef<any>(null);

  // load vehicles & favorites
  useEffect(()=>{ (async()=>{
    try{
      const [vt, fav] = await Promise.all([
        fetch('/api/vehicle-types',{cache:'no-store'}).then(r=>r.json()).catch(()=>null),
        fetch('/api/favorites',{cache:'no-store'}).then(r=> r.status===200? r.json():{ok:false}).catch(()=>null)
      ]);
      if(vt?.ok) setVehicles(vt.items||[]);
      if(fav?.ok) setFavorites(fav.items||[]);
      if(vt?.ok && vt.items?.length && vehicleId==null) setVehicleId(vt.items[0].id);
    }catch{}
  })(); },[]);

  const bothSelected = !!(pickupSel && dropoffSel);
  const quotePayload = useMemo(()=>({
    pickupAddress: pickupSel?.text || '',
    dropoffAddress: dropoffSel?.text || '',
    pickupLat: pickupSel?.lat ?? null,
    pickupLon: pickupSel?.lon ?? null,
    dropoffLat: dropoffSel?.lat ?? null,
    dropoffLon: dropoffSel?.lon ?? null,
    when: whenType==='now' ? new Date().toISOString() : new Date(when).toISOString(),
    passengers: 1, // unused, kept for API compatibility
    vehicleTypeId: vehicleId || undefined
  }),[pickupSel, dropoffSel, whenType, when, vehicleId]);

  // Auto-quote only when both are selected AND vehicle selected
  useEffect(()=>{
    if(qTimer.current) clearTimeout(qTimer.current);
    const ready = bothSelected && !!vehicleId;
    if(!ready){ setQuote(null); setQErr(null); return; }
    qTimer.current = setTimeout(async()=>{
      try{
        setQLoading(true); setQErr(null);
        const r = await fetch('/api/quote', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(quotePayload) });
        const j = await r.json();
        if(!r.ok || !j?.ok) throw new Error(j?.error||'Failed to get quote');
        setQuote({ price: j.price, distanceKm: j.distanceKm, durationMin: j.durationMin });
      }catch(e:any){ setQuote(null); setQErr(e?.message||'Failed to get quote'); }
      finally{ setQLoading(false); }
    }, 200);
    return ()=>{ if(qTimer.current) clearTimeout(qTimer.current); };
  },[bothSelected, quotePayload, vehicleId]);

  async function doBook(){
    try{
      if(!quote) throw new Error('Please select both addresses and vehicle type to get a price before confirming.');
      const body:any = {
        riderName,
        passengers: 1,
        pickupAddress: quotePayload.pickupAddress,
        dropoffAddress: quotePayload.dropoffAddress,
        pickupLat: quotePayload.pickupLat,
        pickupLon: quotePayload.pickupLon,
        dropoffLat: quotePayload.dropoffLat,
        dropoffLon: quotePayload.dropoffLon,
        vehicleTypeId: vehicleId,
        scheduled: whenType==='later',
        pickupTime: whenType==='later' ? new Date(when).toISOString() : new Date().toISOString()
      };
      const r = await fetch('/api/bookings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json();
      if(!r.ok || !j?.ok) throw new Error(j?.error||'Booking failed');
      location.href = '/history';
    }catch(e:any){ alert(e?.message||'Failed to place booking'); }
  }

  const priceText = quote? formatDKK(quote.price) : formatDKK(0);

  function applyFav(f:any, to:FavApply){
    const s: Suggestion = { id: null, text: f.address, lat: f.lat, lon: f.lon, postcode:null, city:null };
    if(to===FavApply.Pickup){ setPickupSel(s); setPickup(s.text); }
    else { setDropoffSel(s); setDropoff(s.text); }
  }

  async function saveFav(label:string, addressSel: Suggestion | null){
    if(!addressSel) return alert('Select an address first.');
    const r = await fetch('/api/favorites',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label, address: addressSel.text, lat: addressSel.lat, lon: addressSel.lon }) });
    const j = await r.json();
    if(j?.ok){ setFavorites((prev:any[])=> [j.item, ...prev].slice(0,20)); }
  }

  return (
    <div className="grid gap-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">Book a ride</h1>
      {!me && (
        <div className="p-3 rounded-xl border bg-yellow-50 text-yellow-900 text-sm">You must be logged in to book.</div>
      )}

      {/* Price panel */}
      <div className="rounded-2xl border bg-white p-5 flex items-end justify-between">
        <div className="grid gap-1">
          <div className="text-xs uppercase tracking-wide text-gray-500">Estimated price</div>
          <div className="text-5xl font-extrabold leading-none">{priceText}</div>
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
        <div className="hidden md:block" />
      </div>

      <div className="grid gap-4 bg-white border rounded-2xl p-4">
        <AddressAutocomplete label="Pickup address" name="pickup" value={pickup} onChange={v=>{ setPickup(v); setPickupSel(null); }} onSelect={s=>{ setPickupSel(s); setPickup(s.text); }} />
        <div className="flex gap-2 text-xs">
          <button className="px-2 py-1 rounded border" onClick={()=> saveFav('Home', pickupSel)}>Save pickup as Home</button>
          <button className="px-2 py-1 rounded border" onClick={()=> saveFav('Work', pickupSel)}>Save pickup as Work</button>
        </div>

        <AddressAutocomplete label="Dropoff address" name="dropoff" value={dropoff} onChange={v=>{ setDropoff(v); setDropoffSel(null); }} onSelect={s=>{ setDropoffSel(s); setDropoff(s.text); }} />
        <div className="flex gap-2 text-xs">
          <button className="px-2 py-1 rounded border" onClick={()=> saveFav('Work', dropoffSel)}>Save dropoff as Work</button>
          <button className="px-2 py-1 rounded border" onClick={()=> saveFav('Other', dropoffSel)}>Save dropoff as Other</button>
        </div>

        {favorites.length>0 && (
          <div className="grid gap-2">
            <div className="text-sm text-gray-700">Favorites</div>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f:any)=> (
                <div key={f.id} className="flex items-center gap-2 border rounded-xl px-2 py-1 bg-gray-50">
                  <div className="text-xs">{f.label}: <span className="text-gray-600">{f.address}</span></div>
                  <button className="text-xs underline" onClick={()=> applyFav(f, FavApply.Pickup)}>Set as pickup</button>
                  <button className="text-xs underline" onClick={()=> applyFav(f, FavApply.Dropoff)}>Set as dropoff</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vehicle type selection */}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Vehicle type">
            <select value={vehicleId??''} onChange={e=> setVehicleId(e.target.value? Number(e.target.value): null)} className="px-3 py-2 rounded-xl border bg-white">
              {vehicles.map(v=> <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </Field>
          <Field label="When">
            <select value={whenType} onChange={e=> setWhenType(e.target.value as any)} className="px-3 py-2 rounded-xl border bg-white">
              <option value="now">Immediate</option>
              <option value="later">Schedule for later</option>
            </select>
          </Field>
          {whenType==='later' && (
            <Field label="Pickup time">
              <input type="datetime-local" value={when} onChange={e=> setWhen(e.target.value)} className="px-3 py-2 rounded-xl border bg-white"/>
            </Field>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={doBook} disabled={!me || !quote || qLoading || !bothSelected || !vehicleId} className={`px-4 py-2 rounded-2xl ${(!me || !quote || qLoading || !bothSelected || !vehicleId)? 'bg-gray-300 text-gray-600':'bg-black text-white'}`}>
            Confirm booking
          </button>
          {!me && <span className="text-sm text-gray-500">Login required</span>}
          {quote && (
            <span className="text-sm text-gray-600">Price will be saved with the booking.</span>
          )}
        </div>
      </div>
    </div>
  );
}
