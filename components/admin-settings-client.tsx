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
  Info,
  X
} from 'lucide-react';

const f=(u:string,o?:any)=> fetch(u,o).then(r=>r.json());

export default function AdminSettingsClient(){
  const { data, mutate } = useSWR('/api/admin/settings', (u)=>f(u));
  const s = data?.settings;

  async function saveSettings(e:React.FormEvent){
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload:any = Object.fromEntries(fd.entries());
    // cast numbers
    ['dayBase','dayPerKm','dayPerMin','nightBase','nightPerKm','nightPerMin','scheduledCancellationFee1','scheduledCancellationFee2','scheduledCancellationFee3','immediateCancellationFee'].forEach(k=> payload[k]=Number(payload[k]));
    // Send in the expected shape for the API: { settings: { ... } }
    const res = await f('/api/admin/settings',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ settings: payload })
    });
    if(res?.ok) mutate();
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
            <p className="text-gray-500 text-sm">Configure company details and pricing rules.</p>
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

        {/* Cancellation Fees */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
                <X size={18} className="text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Cancellation Fees</h2>
            </div>
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">Scheduled Rides</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Field label=">2 hours before (%)" icon={<Clock size={14} />}>
                            <input name="scheduledCancellationFee1" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee1} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        </Field>
                        <Field label="1-2 hours before (%)" icon={<Clock size={14} />}>
                            <input name="scheduledCancellationFee2" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee2} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        </Field>
                        <Field label="<1 hour before (%)" icon={<Clock size={14} />}>
                            <input name="scheduledCancellationFee3" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee3} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        </Field>
                    </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-orange-800 mb-2">Immediate Rides</h3>
                    <div className="grid md:grid-cols-1 gap-4 max-w-xs">
                        <Field label="Fixed cancellation fee (DKK)" icon={<DollarSign size={14} />}>
                            <input name="immediateCancellationFee" type="number" step="0.01" min="0" defaultValue={s.immediateCancellationFee} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        </Field>
                    </div>
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
