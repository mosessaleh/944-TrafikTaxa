"use client";
import useSWR from 'swr';
const fetcher=(u:string)=> fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function AdminVehicles(){
  const { data, mutate } = useSWR('/api/admin/vehicle-types',{ fetcher });
  const items = data?.items||[];

  async function save(row:any){
    await fetch('/api/admin/vehicle-types',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(row) });
    mutate();
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Vehicle types</h1>
      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">#</th><th className="p-3">Key</th><th className="p-3">Title</th><th className="p-3">Capacity</th><th className="p-3">Multiplier</th><th className="p-3">Active</th><th className="p-3">Save</th>
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
                <td className="p-3"><button className="px-3 py-1 rounded border" onClick={()=> save(r)}>Save</button></td>
              </tr>
            ))}
            {items.length===0 && (<tr><td className="p-4" colSpan={7}>No vehicle types yet.</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">Note: final price = base(day/night) × multiplier.</p>
    </div>
  );
}
