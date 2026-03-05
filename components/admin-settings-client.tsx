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

const f=(u:string,o?:any)=> fetch(u,o).then(async (r)=>{
  const json = await r.json().catch(()=>({ ok:false, error:'Invalid JSON response' }));
  if (!r.ok) {
    const message = json?.error || `Request failed (${r.status})`;
    throw new Error(message);
  }
  return json;
});
const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm';

export default function AdminSettingsClient(){
  const { data, mutate, error, isLoading } = useSWR('/api/admin/settings', (u)=>f(u), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const s = data?.settings;
  const schedulePolicy = data?.schedulePolicy;
  const legalMaxDailyMinutes = Number(data?.legalMaxDailyMinutes || 660);

  async function saveSettings(e:React.FormEvent){
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload:any = Object.fromEntries(fd.entries());
    // cast numbers
    ['dayBase','dayPerKm','dayPerMin','nightBase','nightPerKm','nightPerMin','scheduledCancellationFee1','scheduledCancellationFee2','scheduledCancellationFee3','immediateCancellationFee','discountPercentage','maxDiscountAmount','minScheduledLeadMinutes','minScheduledPrice','minImmediatePrice'].forEach(k=> payload[k]=Number(payload[k]));
    // Send in the expected shape for the API: { settings: { ... } }
    const res = await f('/api/admin/settings',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ settings: payload })
    });
    if(res?.ok) mutate();
  }

  async function saveSchedulePolicy(e: React.FormEvent){
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload:any = Object.fromEntries(fd.entries());
    ['maxDailyMinutes','maxWeeklyMinutes','minRestMinutes','lockMinutesBeforeStart'].forEach(k=> payload[k]=Number(payload[k]));
    payload.allowEmergencyOverride = String(payload.allowEmergencyOverride) === 'true';

    const res = await f('/api/admin/settings',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ schedulePolicy: payload })
    });
    if(res?.ok) mutate();
  }


  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="text-base font-semibold">Failed to load settings</h2>
        <p className="text-sm mt-1">{String((error as Error)?.message || 'Unknown error')}</p>
        <button
          onClick={() => mutate()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if(!s) return <div className="p-8 text-center text-gray-500">No settings found.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
              <Settings size={24} />
          </div>
          <div>
              <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
              <p className="text-gray-500 text-sm mt-1">
                تم ترتيب الإعدادات إلى أقسام واضحة: الشركة، التسعير، سياسات الحجز، ثم جدول السائقين.
              </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">Company</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">Pricing</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">Discounts & Fees</span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">Driver Schedule</span>
        </div>
      </div>

      {/* General Settings */}
      <form onSubmit={saveSettings} className="grid gap-6">
        <div className="grid xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-6">
            <SectionCard
              title="Company Information"
              description="Main business identity and contact details"
              icon={<Building size={18} className="text-gray-500" />}
            >
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Brand Name" icon={<Building size={14} />}>
                    <input name="brandName" defaultValue={s.brandName||''} className={inputClass} />
                </Field>
                <Field label="City" icon={<Building size={14} />}>
                    <input name="addressCity" defaultValue={s.addressCity||''} className={inputClass} />
                </Field>
                <Field label="Contact Email" icon={<Mail size={14} />}>
                    <input name="contactEmail" defaultValue={s.contactEmail||''} className={inputClass} />
                </Field>
                <Field label="Contact Phone" icon={<Phone size={14} />}>
                    <input name="contactPhone" defaultValue={s.contactPhone||''} className={inputClass} />
                </Field>
            </div>
            </SectionCard>

            <SectionCard
              title="Base Pricing & Operating Hours"
              description="Day/Night fare rules with active working window"
              icon={<DollarSign size={18} className="text-gray-500" />}
            >
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900">Day Tariff (06:00 → 18:00)</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Start Fare" icon={<Clock size={14} />}>
                        <input name="dayBase" type="number" step="0.01" defaultValue={s.dayBase} className={inputClass} />
                    </Field>
                    <Field label="Per KM" icon={<Car size={14} />}>
                        <input name="dayPerKm" type="number" step="0.01" defaultValue={s.dayPerKm} className={inputClass} />
                    </Field>
                    <Field label="Per Minute" icon={<Clock size={14} />}>
                        <input name="dayPerMin" type="number" step="0.01" defaultValue={s.dayPerMin} className={inputClass} />
                    </Field>
                  </div>
                </div>

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-indigo-900">Night Tariff (18:00 → 06:00)</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Start Fare" icon={<Clock size={14} />}>
                        <input name="nightBase" type="number" step="0.01" defaultValue={s.nightBase} className={inputClass} />
                    </Field>
                    <Field label="Per KM" icon={<Car size={14} />}>
                        <input name="nightPerKm" type="number" step="0.01" defaultValue={s.nightPerKm} className={inputClass} />
                    </Field>
                    <Field label="Per Minute" icon={<Clock size={14} />}>
                        <input name="nightPerMin" type="number" step="0.01" defaultValue={s.nightPerMin} className={inputClass} />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6 grid md:grid-cols-2 gap-6">
                <Field label="Work Start (HH:MM)" icon={<Clock size={14} />}>
                    <input name="workStart" defaultValue={s.workStart} className={inputClass} />
                </Field>
                <Field label="Work End (HH:MM)" icon={<Clock size={14} />}>
                    <input name="workEnd" defaultValue={s.workEnd} className={inputClass} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Booking Minimum Controls"
              description="Minimum lead time and minimum fares"
              icon={<Clock size={18} className="text-gray-500" />}
            >
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <Field label="Min scheduled lead (minutes)" icon={<Clock size={14} />}>
                      <input name="minScheduledLeadMinutes" type="number" step="1" min="0" defaultValue={s.minScheduledLeadMinutes ?? 60} className={inputClass} />
                  </Field>
                  <Field label="Min scheduled fare (DKK)" icon={<DollarSign size={14} />}>
                      <input name="minScheduledPrice" type="number" step="1" min="0" defaultValue={s.minScheduledPrice ?? 0} className={inputClass} />
                  </Field>
                  <Field label="Min immediate fare (DKK, enforced)" icon={<DollarSign size={14} />}>
                      <input name="minImmediatePrice" type="number" step="1" min="0" defaultValue={s.minImmediatePrice ?? 0} className={inputClass} />
                  </Field>
                </div>
                <p className="text-xs text-violet-700 mt-3">
                  Scheduled bookings must respect minimum lead time and minimum fare. Immediate bookings are automatically raised to the configured minimum fare.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              title="Discounts & Cancellation"
              description="Global discount and cancellation fee behavior"
              icon={<X size={18} className="text-gray-500" />}
            >
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-green-800 mb-4">Global Discount</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Field label="Discount Percentage (%)" icon={<DollarSign size={14} />}>
                        <input name="discountPercentage" type="number" step="0.01" min="0" max="100" defaultValue={s.discountPercentage || 0} className={inputClass} />
                    </Field>
                    <Field label="Max Discount Amount (DKK)" icon={<DollarSign size={14} />}>
                        <input name="maxDiscountAmount" type="number" step="0.01" min="0" defaultValue={s.maxDiscountAmount || 0} className={inputClass} />
                    </Field>
                  </div>
                  <p className="text-xs text-green-700 mt-3">
                    Applied to all bookings. Discount = min(price × percentage/100, max amount)
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-800 mb-2">Scheduled Ride Cancellation</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Field label=">2 hours before (%)" icon={<Clock size={14} />}>
                        <input name="scheduledCancellationFee1" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee1} className={inputClass} />
                    </Field>
                    <Field label="1-2 hours before (%)" icon={<Clock size={14} />}>
                        <input name="scheduledCancellationFee2" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee2} className={inputClass} />
                    </Field>
                    <Field label="<1 hour before (%)" icon={<Clock size={14} />}>
                        <input name="scheduledCancellationFee3" type="number" step="0.01" min="0" max="100" defaultValue={s.scheduledCancellationFee3} className={inputClass} />
                    </Field>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-orange-800 mb-2">Immediate Ride Cancellation</h3>
                  <div className="max-w-xs">
                    <Field label="Fixed cancellation fee (DKK)" icon={<DollarSign size={14} />}>
                        <input name="immediateCancellationFee" type="number" step="0.01" min="0" defaultValue={s.immediateCancellationFee} className={inputClass} />
                    </Field>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <aside className="xl:col-span-4">
            <div className="xl:sticky xl:top-6 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
                <p className="text-xs text-gray-500 mt-1 mb-4">
                  جميع الإعدادات العامة محفوظة بزر واحد لتفادي التكرار والارتباك.
                </p>
                <button className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 shadow-sm">
                    <Save size={16} />
                    Save All General Settings
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900">Layout Notes</h3>
                <ul className="mt-3 space-y-2 text-xs text-gray-600 list-disc pl-4">
                  <li>Company information first.</li>
                  <li>Pricing grouped by Day/Night cards.</li>
                  <li>Booking rules separated from pricing.</li>
                  <li>Discount and cancellation grouped together.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>

        <div className="xl:hidden flex justify-end">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm">
            <Save size={16} />
            Save All General Settings
          </button>
        </div>
      </form>

      {/* Driver Schedule Policy */}
      <SectionCard
        title="Driver Work Schedule Policy"
        description="Legal and operational limits for driver schedules"
        icon={<Clock size={18} className="text-gray-500" />}
      >
          <form onSubmit={saveSchedulePolicy} className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  القيد القانوني في الدنمارك: الحد الأقصى اليومي لا يمكن أن يتجاوز
                  <span className="font-semibold"> {legalMaxDailyMinutes} </span>
                  دقيقة (11 ساعة).
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                  <Field label={`Max Daily Minutes (<= ${legalMaxDailyMinutes})`} icon={<Clock size={14} />}>
                      <input
                          name="maxDailyMinutes"
                          type="number"
                          min="60"
                          max={legalMaxDailyMinutes}
                          defaultValue={schedulePolicy?.maxDailyMinutes ?? legalMaxDailyMinutes}
                          className={inputClass}
                      />
                  </Field>
                  <Field label="Max Weekly Minutes" icon={<Clock size={14} />}>
                      <input
                          name="maxWeeklyMinutes"
                          type="number"
                          min="60"
                          max="5400"
                          defaultValue={schedulePolicy?.maxWeeklyMinutes ?? 3360}
                          className={inputClass}
                      />
                  </Field>
                  <Field label="Minimum Rest Minutes" icon={<Clock size={14} />}>
                      <input
                          name="minRestMinutes"
                          type="number"
                          min="0"
                          max="1440"
                          defaultValue={schedulePolicy?.minRestMinutes ?? 660}
                          className={inputClass}
                      />
                  </Field>
                  <Field label="Lock Minutes Before Start" icon={<Clock size={14} />}>
                      <input
                          name="lockMinutesBeforeStart"
                          type="number"
                          min="0"
                          max="1440"
                          defaultValue={schedulePolicy?.lockMinutesBeforeStart ?? 30}
                          className={inputClass}
                      />
                  </Field>
              </div>

              <div className="max-w-sm">
                  <Field label="Allow Emergency Override" icon={<Info size={14} />}>
                      <select
                          name="allowEmergencyOverride"
                          defaultValue={String(Boolean(schedulePolicy?.allowEmergencyOverride ?? true))}
                          className={inputClass}
                      >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                      </select>
                  </Field>
              </div>

              <div className="pt-2 flex justify-end">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm">
                      <Save size={16} />
                      Save Schedule Policy
                  </button>
              </div>
          </form>
      </SectionCard>

    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        {description && <p className="text-xs text-gray-500 mt-1.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
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
