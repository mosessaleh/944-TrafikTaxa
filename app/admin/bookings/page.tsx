"use client";
import useSWR from 'swr';
import { useState, useEffect } from 'react';

const fetcher = (url:string)=> fetch(url,{cache:'no-store'}).then(r=>r.json());

function ActionBtn({id, action, label, icon}:{id:number, action:string, label:string, icon?:string}){
  async function go(){
    await fetch('/api/admin/bookings/update',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, action }) });
    location.reload();
  }
  return <button onClick={go} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all duration-200 flex items-center gap-1">{icon}{label}</button>;
}

function TabBtn({active,label,onClick}:{active:boolean,label:string,onClick:()=>void}){
  return <button onClick={onClick} className={`px-4 py-2 rounded-2xl border font-medium transition-all duration-200 ${active? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg':'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-md'}`} suppressHydrationWarning>{label}</button>;
}

export default function AdminBookings(){
  const { data } = useSWR('/api/admin/bookings',{ fetcher });
  const rides = (data?.rides||[]) as any[];
  const groups = {
    pending: rides.filter(r=> r.status==='PENDING' && !r.paid),
    paid: rides.filter(r=> r.status==='PAID'),
    processing: rides.filter(r=> r.status==='PROGRESSING'),
    confirmedActive: rides.filter(r=> (r.status==='CONFIRMED' || r.status==='DISPATCHED' || r.status==='ONGOING')),
    completed: rides.filter(r=> r.status==='COMPLETED'),
    canceled: rides.filter(r=> r.status==='CANCELED'),
  } as const;
  const tabs = [
    {key:'pending', label:`Awaiting confirmation (${groups.pending.length})`},
    {key:'paid', label:`Paid - awaiting confirmation (${groups.paid.length})`},
    {key:'processing', label:`Processing (${groups.processing.length})`},
    {key:'confirmedActive', label:`Confirmed / not finished (${groups.confirmedActive.length})`},
    {key:'completed', label:`Completed (${groups.completed.length})`},
    {key:'canceled', label:`Canceled (${groups.canceled.length})`}
  ] as const;
  // Use proper React state for tab management
  const [currentTab, setCurrentTab] = useState<keyof typeof groups>('pending');

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? location.hash?.slice(1) : '';
    const validTab = hash && groups[hash as keyof typeof groups] ? hash as keyof typeof groups : 'pending';
    setCurrentTab(validTab);
  }, [data]);

  function switchTab(k: keyof typeof groups){
    setCurrentTab(k);
    if (typeof window !== 'undefined') {
      location.hash = k;
    }
  }

  const list = groups[currentTab];

  return (
    <div className="grid gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">📊 Booking Management</h1>
        <p className="text-slate-600">Manage and track all customer bookings</p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        {tabs.map(t=> (
          <TabBtn key={t.key} active={currentTab===t.key} label={t.label} onClick={()=>switchTab(t.key as any)} />
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-left"><th className="p-4 font-semibold text-slate-700">#</th><th className="p-4 font-semibold text-slate-700">👤 User</th><th className="p-4 font-semibold text-slate-700">📍 Pickup</th><th className="p-4 font-semibold text-slate-700">🎯 Dropoff</th><th className="p-4 font-semibold text-slate-700">🕐 Time</th><th className="p-4 font-semibold text-slate-700">💰 Price</th><th className="p-4 font-semibold text-slate-700">📊 Status</th><th className="p-4 font-semibold text-slate-700">💳 Paid</th><th className="p-4 font-semibold text-slate-700">⚡ Actions</th></tr></thead>
            <tbody>
              {list.map((r:any)=> (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors duration-150">
                  <td className="p-4 font-medium text-slate-800">{r.id}</td>
                  <td className="p-4 text-slate-700">{r.user?.firstName} {r.user?.lastName}</td>
                  <td className="p-4 text-slate-600 max-w-xs truncate">{r.pickupAddress}</td>
                  <td className="p-4 text-slate-600 max-w-xs truncate">{r.dropoffAddress}</td>
                  <td className="p-4 text-slate-600">{new Date(r.pickupTime).toLocaleString()}</td>
                  <td className="p-4 font-semibold text-emerald-600">{r.price} DKK</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      r.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
                      r.status === 'PROGRESSING' ? 'bg-blue-100 text-blue-800' :
                      r.status === 'CONFIRMED' ? 'bg-cyan-100 text-cyan-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {r.paid ? (
                      <span className="text-emerald-600 font-medium">✅ Yes</span>
                    ) : (
                      <span className="text-slate-500">❌ No</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      {r.status==='PENDING' && <ActionBtn id={r.id} action="CONFIRM" label="Confirm" icon="✅" />}
                      {r.status==='PAID' && <ActionBtn id={r.id} action="PROCESS" label="Process" icon="⚙️" />}
                      {r.status==='PROGRESSING' && <ActionBtn id={r.id} action="CONFIRM_BOOKING" label="Confirm" icon="✅" />}
                      {(r.status==='CONFIRMED') && <ActionBtn id={r.id} action="DISPATCH" label="Dispatch" icon="🚗" />}
                      {(r.status==='DISPATCHED') && <ActionBtn id={r.id} action="START" label="Start" icon="▶️" />}
                      {(r.status==='ONGOING') && <ActionBtn id={r.id} action="COMPLETE" label="Complete" icon="🏁" />}
                      {r.status!=='CANCELED' && r.status!=='COMPLETED' && <ActionBtn id={r.id} action="CANCEL" label="Cancel" icon="❌" />}
                      {!r.paid && <ActionBtn id={r.id} action="MARK_PAID" label="Mark Paid" icon="💳" />}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length===0 && (
                <tr><td colSpan={9} className="p-8 text-center text-slate-500">
                  <div className="text-4xl mb-2">📭</div>
                  <div className="font-medium">No bookings in this tab</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
