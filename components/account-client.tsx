"use client";
import { useEffect, useState } from 'react';
import AddressAutocomplete, { type Suggestion } from '@/components/address-autocomplete';

type Me = { id:number; email:string; emailVerified:boolean; firstName:string; lastName:string; phone:string; street:string; houseNumber:string; postalCode:string; city:string } | null;

type Ride = { id:number; pickupAddress:string; dropoffAddress:string; pickupTime:string; price:number; status:string };

type Fav = { id:number; label:string; address:string; lat:number|null; lon:number|null };

type Tab = 'profile'|'history'|'favorites';

function TabButton({active, children, onClick}:{active:boolean; children:React.ReactNode; onClick:()=>void}){
  return <button onClick={onClick} className={`px-4 py-2 rounded-2xl border transition ${active? 'bg-black text-white border-black shadow-sm':'bg-white text-black hover:bg-gray-100'}`}>{children}</button>;
}
function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
function Modal({ open, onClose, title, children }:{ open:boolean; onClose:()=>void; title:string; children:React.ReactNode }){
  if(!open) return null;
  return (
    <div className="modal-wrap">
      <div className="modal-overlay" onClick={onClose}/>
      <div className="modal-box">
        <div className="modal-head px-4 pt-4">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} aria-label="Close" className="px-2 py-1 text-sm rounded border">✕</button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AccountClient(){
  const [tab, setTab] = useState<Tab>(()=>{ if (typeof window === 'undefined') return 'profile'; const u = new URL(window.location.href); const t = u.searchParams.get('tab'); return (t==='history'||t==='favorites')? (t as Tab) : 'profile'; });
  useEffect(()=>{ if(typeof window==='undefined') return; const u = new URL(window.location.href); u.searchParams.set('tab', tab); history.replaceState(null, '', u.toString()); },[tab]);

  const [me, setMe] = useState<Me>(null);
  const [saving, setSaving] = useState(false);
  const [rides, setRides] = useState<Ride[]>([]);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [msg, setMsg] = useState<string| null>(null);

  // Add Favorite modal state
  const [addFavOpen, setAddFavOpen] = useState(false);
  const [favLabel, setFavLabel] = useState('');
  const [favAddress, setFavAddress] = useState('');
  const [favSel, setFavSel] = useState<Suggestion | null>(null);

  useEffect(()=>{ (async()=>{ try{ const r = await fetch('/api/profile', { cache:'no-store' }); if(r.ok){ const j = await r.json(); setMe(j.me); } else setMe(null);}catch{ setMe(null);} })(); },[]);
  useEffect(()=>{ if(tab!=='history') return; (async()=>{ try{ const r = await fetch('/api/bookings',{cache:'no-store'}); if(r.ok){ const j=await r.json(); setRides(j.rides||[]);} }catch{} })(); },[tab]);
  useEffect(()=>{ if(tab!=='favorites') return; (async()=>{ try{ const r = await fetch('/api/favorites',{cache:'no-store'}); if(r.ok){ const j=await r.json(); setFavs(j.items||[]);} }catch{} })(); },[tab]);

  async function saveProfile(){
    try{ if(!me) return; setSaving(true); setMsg(null);
      const r = await fetch('/api/profile', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(me) });
      const j = await r.json();
      if(!r.ok || !j?.ok) throw new Error(j?.error||'Save failed');
      setMsg('Profile saved');
    }catch(e:any){ setMsg(e?.message||'Save failed'); }
    finally{ setSaving(false); }
  }
  async function updateFav(row: Fav){ const r = await fetch('/api/favorites', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(row) }); const j = await r.json(); if(j?.ok){ setFavs(prev=> prev.map(x=> x.id===row.id? j.item: x)); } }
  async function deleteFav(id:number){ const r = await fetch(`/api/favorites?id=${id}`, { method:'DELETE' }); const j = await r.json(); if(j?.ok){ setFavs(prev=> prev.filter(x=> x.id!==id)); } }
  async function createFav(){ try{ const address = (favSel?.text || favAddress).trim(); const label = favLabel.trim() || 'Favorite'; if(!address) return; const res = await fetch('/api/favorites', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label, address, lat: favSel?.lat ?? null, lon: favSel?.lon ?? null }) }); const j = await res.json(); if(j?.ok){ setFavs(prev => [j.item, ...prev]); setAddFavOpen(false); setFavLabel(''); setFavAddress(''); setFavSel(null); } }catch{} }

  if(me===null){ return <div className="container-page p-4"><div className="card"><div className="card-body">Loading…</div></div></div>; }
  if(!me){ return <div className="container-page p-4"><div className="card"><div className="card-body bg-yellow-50 border-yellow-200">Please login to view your account.</div></div></div>; }

  return (
    <div className="container-page p-4 grid gap-6">
      <h1>Account</h1>
      <div className="flex gap-2">
        <TabButton active={tab==='profile'} onClick={()=> setTab('profile')}>Profile</TabButton>
        <TabButton active={tab==='history'} onClick={()=> setTab('history')}>History</TabButton>
        <TabButton active={tab==='favorites'} onClick={()=> setTab('favorites')}>Favorites</TabButton>
      </div>

      {tab==='profile' && (
        <div className="card">
          <div className="card-body grid gap-4">
            {!me.emailVerified && <div className="p-2 rounded-lg text-sm bg-orange-50 text-orange-900 border">Your email is not verified.</div>}
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="First name"><input value={me.firstName} onChange={e=> setMe({...me!, firstName:e.target.value})} className="input"/></Field>
              <Field label="Last name"><input value={me.lastName} onChange={e=> setMe({...me!, lastName:e.target.value})} className="input"/></Field>
              <Field label="Email"><input value={me.email} onChange={e=> setMe({...me!, email:e.target.value})} className="input"/></Field>
              <Field label="Phone"><input value={me.phone} onChange={e=> setMe({...me!, phone:e.target.value})} className="input"/></Field>
              <Field label="Street"><input value={me.street} onChange={e=> setMe({...me!, street:e.target.value})} className="input"/></Field>
              <Field label="House no."><input value={me.houseNumber} onChange={e=> setMe({...me!, houseNumber:e.target.value})} className="input"/></Field>
              <Field label="Postal code"><input value={me.postalCode} onChange={e=> setMe({...me!, postalCode:e.target.value})} className="input"/></Field>
              <Field label="City"><input value={me.city} onChange={e=> setMe({...me!, city:e.target.value})} className="input"/></Field>
            </div>
            <div className="flex items-center gap-3">
              <button disabled={saving} onClick={saveProfile} className={saving? 'btn-muted':'btn-primary'}>{saving? 'Saving…':'Save'}</button>
              {msg && <span className="text-sm text-gray-600">{msg}</span>}
            </div>
          </div>
        </div>
      )}

      {tab==='history' && (
        <div className="grid gap-3">
          <div>
            <a href="/book" className="btn-primary">Book a new ride</a>
          </div>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">#</th>
                  <th className="th">Pickup</th>
                  <th className="th">Dropoff</th>
                  <th className="th">Time</th>
                  <th className="th">Price</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {rides.map(r=> (
                  <tr key={r.id} className="tr">
                    <td className="td">{r.id}</td>
                    <td className="td">{r.pickupAddress}</td>
                    <td className="td">{r.dropoffAddress}</td>
                    <td className="td">{new Date(r.pickupTime).toLocaleString()}</td>
                    <td className="td">{r.price} DKK</td>
                    <td className="td uppercase text-xs">{r.status}</td>
                  </tr>
                ))}
                {rides.length===0 && (<tr><td className="td" colSpan={6}>No rides yet.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='favorites' && (
        <div className="grid gap-3">
          <div>
            <button onClick={()=>{ setAddFavOpen(true); setFavLabel(''); setFavAddress(''); setFavSel(null); }} className="btn-ghost">Add favorite</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead className="thead">
                <tr>
                  <th className="th">Label</th>
                  <th className="th">Address</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {favs.map(f=> (
                  <tr key={f.id} className="tr">
                    <td className="td"><input defaultValue={f.label} onChange={e=> f.label=e.target.value} className="input"/></td>
                    <td className="td"><input defaultValue={f.address} onChange={e=> f.address=e.target.value} className="input w-[30rem] max-w-full"/></td>
                    <td className="td flex gap-2">
                      <button className="btn-ghost" onClick={()=> updateFav(f)}>Save</button>
                      <button className="btn-danger" onClick={()=> deleteFav(f.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {favs.length===0 && (<tr><td className="td" colSpan={3}>No favorites yet.</td></tr>)}
              </tbody>
            </table>
          </div>

          <Modal open={addFavOpen} onClose={()=> setAddFavOpen(false)} title="Add favorite">
            <div className="grid gap-3">
              <Field label="Label"><input value={favLabel} onChange={e=> setFavLabel(e.target.value)} placeholder="e.g. Home, Work" className="input"/></Field>
              <div className="grid gap-1">
                <div className="label">Address</div>
                <AddressAutocomplete label=" " name="favAddress" value={favSel? favSel.text : favAddress} onChange={v=>{ setFavAddress(v); setFavSel(null); }} onSelect={(s)=>{ setFavSel(s); }}/>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={()=> setAddFavOpen(false)} className="btn-ghost">Cancel</button>
                <button onClick={createFav} className="btn-primary">Save</button>
              </div>
            </div>
          </Modal>
        </div>
      )}
    </div>
  );
}
