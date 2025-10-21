"use client";
import { useState } from 'react';

export default function BookingForm(){
  const [f,setF]=useState({
    riderName:'',
    passengers:1,
    pickupAddress:'',
    dropoffAddress:'',
    tripType:'immediate', // 'immediate' | 'scheduled'
    pickupTime:'' // ISO when scheduled
  });
  const [quote,setQuote]=useState<any>(null);
  const [msg,setMsg]=useState('');
  const [err,setErr]=useState('');
  const scheduled = f.tripType === 'scheduled';

  async function getQuote(){
    setErr(''); setMsg(''); setQuote(null);
    const whenISO = scheduled && f.pickupTime ? f.pickupTime : new Date().toISOString();
    const res = await fetch('/api/quote',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        pickupAddress: f.pickupAddress,
        dropoffAddress: f.dropoffAddress,
        passengers: Number(f.passengers),
        when: whenISO
      })
    });
    const j = await res.json();
    if(!j.ok){
      if(j.needTwoCars){ setErr('More than 4 passengers: please book two cars or reduce passengers.'); }
      else { setErr(j.error||'Failed to get quote'); }
      return;
    }
    setQuote(j);
  }

  async function submit(e:React.FormEvent){
    e.preventDefault(); setErr(''); setMsg('');
    if (!quote){ await getQuote(); if(!quote) return; }
    const res = await fetch('/api/bookings',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        riderName: f.riderName || 'Self',
        passengers: Number(f.passengers),
        pickupAddress: f.pickupAddress,
        dropoffAddress: f.dropoffAddress,
        scheduled,
        pickupTime: scheduled && f.pickupTime ? f.pickupTime : new Date().toISOString()
      })
    });
    const j = await res.json();
    if(!j.ok){
      if(j.needTwoCars){ setErr('More than 4 passengers: please book two cars or cancel.'); }
      else { setErr(j.error||'Booking failed'); }
      return;
    }
    setMsg('Booking created successfully! We will contact you shortly.');
    setQuote(null);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      {/* Rider name */}
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Passenger name (if booking for someone else)</span>
        <input className="border rounded-xl px-4 py-3" placeholder="Passenger full name" onChange={e=>setF({...f,riderName:e.target.value})} />
      </label>

      {/* Passengers */}
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Number of passengers (max 4 per car)</span>
        <input className="border rounded-xl px-4 py-3" type="number" min={1} max={4} defaultValue={1} onChange={e=>setF({...f,passengers:Number(e.target.value)})} />
      </label>

      {/* Trip type */}
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Trip type</span>
        <select className="border rounded-xl px-4 py-3" value={f.tripType} onChange={e=>setF({...f,tripType:e.target.value as 'immediate'|'scheduled'})}>
          <option value="immediate">Immediate</option>
          <option value="scheduled">Schedule for later</option>
        </select>
      </label>

      {/* Pickup/Dropoff */}
      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Pickup address (you can also enter lat,lng)</span>
        <input className="border rounded-xl px-4 py-3" placeholder="e.g., Rådhuspladsen, København or 55.676,12.568" onChange={e=>setF({...f,pickupAddress:e.target.value})} />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-gray-600">Dropoff address (you can also enter lat,lng)</span>
        <input className="border rounded-xl px-4 py-3" placeholder="e.g., Copenhagen Airport or 55.618,12.65" onChange={e=>setF({...f,dropoffAddress:e.target.value})} />
      </label>

      {/* When (only if scheduled) */}
      {scheduled && (
        <label className="grid gap-1">
          <span className="text-sm text-gray-600">Pickup time</span>
          <input className="border rounded-xl px-4 py-3" type="datetime-local" onChange={e=>setF({...f,pickupTime: e.target.value? new Date(e.target.value).toISOString():''})} />
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={getQuote} className="border rounded-2xl px-5 py-3">Get quote</button>
        <button className="bg-black text-white rounded-2xl px-5 py-3">Book now</button>
      </div>

      {quote && (
        <div className="text-sm text-gray-700">
          Distance ~ {quote.distanceKm.toFixed(2)} km · Duration ~ {quote.durationMin} min · Estimated price ~ {quote.price} DKK
        </div>
      )}
      {msg && <p className="text-green-600">{msg}</p>}
      {err && <p className="text-red-600">{err}</p>}
    </form>
  );
}
