"use client";
import useSWR from 'swr';
const f=(u:string,o?:any)=> fetch(u,o).then(r=>r.json());

export default function AdminSettingsClient(){
  const { data, mutate } = useSWR('/api/admin/settings', (u)=>f(u));
  const s = data?.settings;
  const { data: vt, mutate: mVt } = useSWR('/api/admin/vehicle-types', (u)=>f(u));
  const items = vt?.items||[];

  async function saveSettings(e:React.FormEvent){
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload:any = Object.fromEntries(fd.entries());
    // cast numbers
    ['dayBase','dayPerKm','dayPerMin','nightBase','nightPerKm','nightPerMin'].forEach(k=> payload[k]=Number(payload[k]));
    const res = await f('/api/admin/settings',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if(res?.ok) mutate();
  }

  async function saveRow(r:any){
    const res = await f('/api/admin/vehicle-types',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(r) });
    if(res?.ok) mVt();
  }

  if(!s) return <div className="p-4">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto p-4 grid gap-8">
      <h1 className="text-2xl font-bold">Admin Settings</h1>

      {/* Company + Pricing */}
      <form onSubmit={saveSettings} className="grid gap-4 rounded-2xl border bg-white p-4">
        <div className="text-lg font-semibold">Company information</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Brand name"><input name="brandName" defaultValue={s.brandName||''} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="City"><input name="addressCity" defaultValue={s.addressCity||''} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Contact email"><input name="contactEmail" defaultValue={s.contactEmail||''} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Contact phone"><input name="contactPhone" defaultValue={s.contactPhone||''} className="px-3 py-2 rounded-xl border bg-white"/></Field>
        </div>

        <div className="mt-4 text-lg font-semibold">Pricing (base rules)</div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Day start (06–18)"><input name="dayBase" type="number" step="0.01" defaultValue={s.dayBase} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Day per km"><input name="dayPerKm" type="number" step="0.01" defaultValue={s.dayPerKm} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Day per min"><input name="dayPerMin" type="number" step="0.01" defaultValue={s.dayPerMin} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Night start (18–06)"><input name="nightBase" type="number" step="0.01" defaultValue={s.nightBase} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Night per km"><input name="nightPerKm" type="number" step="0.01" defaultValue={s.nightPerKm} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Night per min"><input name="nightPerMin" type="number" step="0.01" defaultValue={s.nightPerMin} className="px-3 py-2 rounded-xl border bg-white"/></Field>
        </div>

        <div className="grid md:grid-cols-2 gap-3 mt-2">
          <Field label="Work start (HH:MM)"><input name="workStart" defaultValue={s.workStart} className="px-3 py-2 rounded-xl border bg-white"/></Field>
          <Field label="Work end (HH:MM)"><input name="workEnd" defaultValue={s.workEnd} className="px-3 py-2 rounded-xl border bg-white"/></Field>
        </div>

        <div className="pt-2">
          <button className="px-4 py-2 rounded-2xl bg-black text-white">Save settings</button>
        </div>
      </form>

      {/* Vehicle types inline management */}
      <div className="grid gap-3 rounded-2xl border bg-white p-4">
        <div className="text-lg font-semibold">Vehicle types</div>
        <div className="rounded-2xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="p-3">#</th>
              <th className="p-3">Key</th>
              <th className="p-3">Title</th>
              <th className="p-3">Capacity</th>
              <th className="p-3">Multiplier</th>
              <th className="p-3">Active</th>
              <th className="p-3">Save</th>
            </tr></thead>
            <tbody>
              {items.map((r:any)=> (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{r.id}</td>
                  <td className="p-3">{r.key}</td>
                  <td className="p-3"><input defaultValue={r.title} onChange={e=> r.title=e.target.value} className="px-2 py-1 border rounded"/></td>
                  <td className="p-3"><input type="number" min={1} max={16} defaultValue={r.capacity} onChange={e=> r.capacity=Number(e.target.value)} className="px-2 py-1 border rounded w-24"/></td>
                  <td className="p-3"><input type="number" step="0.01" min={0.1} defaultValue={Number(r.multiplier)} onChange={e=> r.multiplier=Number(e.target.value)} className="px-2 py-1 border rounded w-24"/></td>
                  <td className="p-3"><input type="checkbox" defaultChecked={r.active} onChange={e=> r.active=e.target.checked}/></td>
                  <td className="p-3"><button className="px-3 py-1 rounded border" onClick={()=> saveRow(r)}>Save</button></td>
                </tr>
              ))}
              {items.length===0 && (<tr><td className="p-4" colSpan={7}>No vehicle types yet.</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">Final price = base (day/night) × multiplier per vehicle type.</p>
      </div>
    </div>
  );
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <div className="text-sm text-gray-700">{label}</div>
      {children}
    </div>
  );
}
