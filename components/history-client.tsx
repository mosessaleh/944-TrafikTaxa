"use client";
import { useMemo, useState } from 'react';

type Ride = {
  id:number; status:string; pickupTime:string; pickupAddress:string; dropoffAddress:string; price:any; passengers:number; riderName:string; paymentMethod?:string;
};

export default function HistoryClient({ initialRides }:{ initialRides: Ride[] }){
  const [time, setTime] = useState<'all'|'past'|'ongoing'|'upcoming'>('all');
  const [status, setStatus] = useState<'all'|'PENDING'|'CONFIRMED'|'DISPATCHED'|'ONGOING'|'COMPLETED'|'CANCELED'>('all');

  const items = useMemo(()=>{
    const now = Date.now();
    return (initialRides||[])
      .filter(r=> status==='all' ? true : r.status===status)
      .filter(r=>{
        if(time==='all') return true;
        const t = new Date(r.pickupTime).getTime();
        if(time==='past') return t < now && (r.status==='COMPLETED' || r.status==='CANCELED');
        if(time==='ongoing') return (r.status==='CONFIRMED' || r.status==='DISPATCHED' || r.status==='ONGOING');
        if(time==='upcoming') return t >= now && (r.status==='PENDING' || r.status==='CONFIRMED');
        return true;
      })
      .sort((a,b)=> new Date(b.pickupTime).getTime() - new Date(a.pickupTime).getTime());
  },[initialRides, time, status]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={time} onChange={e=>setTime(e.target.value as any)} className="px-3 py-2 rounded-xl border bg-white">
          <option value="all">All times</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Active / In progress</option>
          <option value="past">Past</option>
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value as any)} className="px-3 py-2 rounded-xl border bg-white">
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELED">Canceled</option>
        </select>
        <div className="text-sm text-gray-500">Sorted by newest first</div>
      </div>
      <div className="grid gap-3">
        {items.map(r=> (
          <div key={r.id} className="rounded-2xl border bg-white p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <div className="grid gap-1">
              <div className="text-sm text-gray-500">#{r.id} • {r.status}</div>
              <div className="font-semibold">{new Date(r.pickupTime).toLocaleString()}</div>
              <div className="text-sm">{r.pickupAddress} → {r.dropoffAddress}</div>
              <div className="text-xs text-gray-500">Rider: {r.riderName} • Passengers: {r.passengers}</div>
            </div>
            <div className="text-right flex flex-col items-end gap-2">
              <div className="text-2xl font-bold">{Number(r.price)} DKK</div>
              {(!r.paymentMethod || r.paymentMethod === null || r.paymentMethod === '') &&
               r.status !== 'CANCELED' && r.status !== 'COMPLETED' && (
                <a
                  href={`/pay?booking_id=${r.id}`}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    r.status === 'PAID' || r.status === 'CONFIRMED' ||
                    r.status === 'REFUNDING' || r.status === 'REFUNDED'
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed pointer-events-none'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Pay Now
                </a>
              )}
            </div>
          </div>
        ))}
        {items.length===0 && (
          <div className="p-4 rounded-2xl border bg-gray-50 text-gray-700">No trips match your filters.</div>
        )}
      </div>
    </div>
  );
}
