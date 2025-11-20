"use client";
import useSWR from 'swr';
import { 
  Settings, 
  Building, 
  Phone, 
  Mail, 
  Clock, 
  DollarSign, 
  Car, 
  Save,
  Info
} from 'lucide-react';

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
    // Send in the expected shape for the API: { settings: { ... } }
    const res = await f('/api/admin/settings',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ settings: payload })
    });
    if(res?.ok) mutate();
  }

  async function saveRow(r:any){
    const res = await f('/api/admin/vehicle-types',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(r) });
    if(res?.ok) mVt();
  }

  if(!s) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
            <Settings size={24} />
        </div>
        <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-500 text-sm">Configure company details, pricing rules, and vehicle types.</p>
        </div>
      </div>

      {/* Company + Pricing */}
      <form onSubmit={saveSettings} className="grid gap-6">
        
        {/* Company Information */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
                <Building size={18} className="text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
            </div>
            <div className="p-6 grid md:grid-cols-2 gap-6">
                <Field label="Brand Name" icon={<Building size={14} />}>
                    <input name="brandName" defaultValue={s.brandName||''} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </Field>
                <Field label="City" icon={<Building size={14} />}>
                    <input name="addressCity" defaultValue={s.addressCity||''} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </Field>
                <Field label="Contact Email" icon={<Mail size={14} />}>
                    <input name="contactEmail" defaultValue={s.contactEmail||''} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </Field>
                <Field label="Contact Phone" icon={<Phone size={14} />}>
                    <input name="contactPhone" defaultValue={s.contactPhone||''} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </Field>
            </div>
        </div>

        {/* Pricing Rules */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
                <DollarSign size={18} className="text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Base Pricing Rules</h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                    <Field label="Day Start (06–18)" icon={<Clock size={14} />}>
                        <input name="dayBase" type="number" step="0.01" defaultValue={s.dayBase} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                    <Field label="Day per km" icon={<Car size={14} />}>
                        <input name="dayPerKm" type="number" step="0.01" defaultValue={s.dayPerKm} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                    <Field label="Day per min" icon={<Clock size={14} />}>
                        <input name="dayPerMin" type="number" step="0.01" defaultValue={s.dayPerMin} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    <Field label="Night Start (18–06)" icon={<Clock size={14} />}>
                        <input name="nightBase" type="number" step="0.01" defaultValue={s.nightBase} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                    <Field label="Night per km" icon={<Car size={14} />}>
                        <input name="nightPerKm" type="number" step="0.01" defaultValue={s.nightPerKm} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                    <Field label="Night per min" icon={<Clock size={14} />}>
                        <input name="nightPerMin" type="number" step="0.01" defaultValue={s.nightPerMin} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                </div>
                
                <div className="border-t border-gray-100 pt-6 grid md:grid-cols-2 gap-6">
                    <Field label="Work Start (HH:MM)" icon={<Clock size={14} />}>
                        <input name="workStart" defaultValue={s.workStart} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                    <Field label="Work End (HH:MM)" icon={<Clock size={14} />}>
                        <input name="workEnd" defaultValue={s.workEnd} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                    </Field>
                </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm">
                    <Save size={16} />
                    Save Settings
                </button>
            </div>
        </div>
      </form>

      {/* Vehicle types inline management */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
            <Car size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Vehicle Types Configuration</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 w-16">#</th>
                <th className="px-6 py-3">Key</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3 w-24">Capacity</th>
                <th className="px-6 py-3 w-24">Multiplier</th>
                <th className="px-6 py-3 w-24">Active</th>
                <th className="px-6 py-3 w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r:any)=> (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 text-gray-500">{r.id}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{r.key}</td>
                  <td className="px-6 py-3">
                    <input defaultValue={r.title} onChange={e=> r.title=e.target.value} className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 transition-colors" />
                  </td>
                  <td className="px-6 py-3">
                    <input type="number" min={1} max={16} defaultValue={r.capacity} onChange={e=> r.capacity=Number(e.target.value)} className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500" />
                  </td>
                  <td className="px-6 py-3">
                    <input type="number" step="0.01" min={0.1} defaultValue={Number(r.multiplier)} onChange={e=> r.multiplier=Number(e.target.value)} className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-center focus:outline-none focus:border-blue-500" />
                  </td>
                  <td className="px-6 py-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={r.active} onChange={e=> r.active=e.target.checked} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={()=> saveRow(r)} className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wide">Save</button>
                  </td>
                </tr>
              ))}
              {items.length===0 && (<tr><td className="px-6 py-8 text-center text-gray-500" colSpan={7}>No vehicle types configured.</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="bg-blue-50 px-6 py-4 border-t border-blue-100 flex gap-3">
            <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
                Final price calculation: Base Price (Day/Night) × Distance × Vehicle Multiplier.
            </p>
        </div>
      </div>
    </div>
  );
}

function Field({label, icon, children}:{label:string; icon?: React.ReactNode; children:React.ReactNode}){
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
