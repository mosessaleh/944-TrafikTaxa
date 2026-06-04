"use client";

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Building,
  CalendarClock,
  Car,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  TimerReset,
  WalletCards,
} from 'lucide-react';
import { useAdminTranslations } from './admin-i18n';

const f = (u: string, o?: RequestInit) =>
  fetch(u, o).then(async (r) => {
    const json = await r.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }));
    if (!r.ok) {
      throw new Error(json?.error || `Request failed (${r.status})`);
    }
    return json;
  });

const inputClass =
  'w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50';

export default function AdminSettingsClient() {
  const { t, tuple } = useAdminTranslations();
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [openHelp, setOpenHelp] = useState<string | null>(null);

  const { data, mutate, error, isLoading } = useSWR('/api/admin/settings', (u) => f(u), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const s = data?.settings;
  const schedulePolicy = data?.schedulePolicy;
  const legalMaxDailyMinutes = Number(data?.legalMaxDailyMinutes || 660);

  const bookingModeSummary = useMemo(() => {
    const immediate = Boolean(s?.allowImmediateBooking ?? true);
    const scheduled = Boolean(s?.allowScheduledBooking ?? true);
    if (immediate && scheduled) return t('admin.settings.bookingModes.both');
    if (immediate) return t('admin.settings.bookingModes.immediate');
    if (scheduled) return t('admin.settings.bookingModes.scheduled');
    return t('admin.settings.bookingModes.paused');
  }, [s, t]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload: any = Object.fromEntries(fd.entries());

    [
      'dayBase',
      'dayPerKm',
      'dayPerMin',
      'nightBase',
      'nightPerKm',
      'nightPerMin',
      'scheduledCancellationFee1',
      'scheduledCancellationFee2',
      'scheduledCancellationFee3',
      'immediateCancellationFee',
      'discountPercentage',
      'maxDiscountAmount',
      'minScheduledLeadMinutes',
      'minScheduledPrice',
      'minImmediatePrice',
    ].forEach((k) => {
      payload[k] = Number(payload[k]);
    });

    payload.allowImmediateBooking = String(payload.allowImmediateBooking) === 'true';
    payload.allowScheduledBooking = String(payload.allowScheduledBooking) === 'true';

    setSavingGeneral(true);
    try {
      const res = await f('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      if (res?.ok) {
        setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        mutate();
      }
    } finally {
      setSavingGeneral(false);
    }
  }

  async function saveSchedulePolicy(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const payload: any = Object.fromEntries(fd.entries());

    ['maxDailyMinutes', 'maxWeeklyMinutes', 'minRestMinutes', 'lockMinutesBeforeStart'].forEach((k) => {
      payload[k] = Number(payload[k]);
    });
    payload.allowEmergencyOverride = String(payload.allowEmergencyOverride) === 'true';

    setSavingSchedule(true);
    try {
      const res = await f('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedulePolicy: payload }),
      });
      if (res?.ok) {
        setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        mutate();
      }
    } finally {
      setSavingSchedule(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] px-4 py-6">
        <div className="space-y-4">
          <div className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          <div className="grid lg:grid-cols-[220px_1fr] gap-5">
            <div className="h-64 rounded-lg bg-gray-100 animate-pulse" />
            <div className="space-y-3">
              <div className="h-44 rounded-lg bg-gray-100 animate-pulse" />
              <div className="h-44 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} />
            {t('admin.settings.loadFailed')}
          </div>
          <p className="text-sm mt-2">{String((error as Error)?.message || 'Unknown error')}</p>
          <button
            onClick={() => mutate()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!s) {
    return <div className="px-4 py-8 text-center text-gray-500">No settings found.</div>;
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <header className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-gray-900 text-white flex items-center justify-center shrink-0">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-950">{t('admin.settings.title')}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <StatusPill icon={<Building size={13} />} label={s.brandName || '944 Trafik'} />
                <StatusPill icon={<MapPin size={13} />} label={s.addressCity || 'City'} />
                <StatusPill icon={<WalletCards size={13} />} label={bookingModeSummary} />
                {savedAt && <StatusPill icon={<Check size={13} />} label={`${t('admin.settings.saved')} ${savedAt}`} tone="green" />}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={15} />
              {t('admin.common.refresh')}
            </button>
            <button
              form="general-settings-form"
              disabled={savingGeneral}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Save size={15} />
              {savingGeneral ? t('admin.common.saving') : t('admin.common.saveSettings')}
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-5">
          <form id="general-settings-form" onSubmit={saveSettings} className="space-y-5">
            <SettingsSection
              id="company"
              title={t('admin.settings.company')}
              icon={<Building size={18} />}
              action={<SectionBadge icon={<Mail size={13} />} text={s.contactEmail || 'No email'} />}
              help={tuple('admin.settings.help.company')}
              impactLabel={t('admin.settings.impact')}
              helpOpen={openHelp === 'company'}
              onHelpToggle={() => setOpenHelp(openHelp === 'company' ? null : 'company')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('admin.settings.brandName')}>
                  <input name="brandName" defaultValue={s.brandName || ''} className={inputClass} />
                </Field>
                <Field label={t('admin.settings.city')}>
                  <input name="addressCity" defaultValue={s.addressCity || ''} className={inputClass} />
                </Field>
                <Field label={t('admin.settings.contactEmail')}>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input name="contactEmail" defaultValue={s.contactEmail || ''} className={`${inputClass} pl-9`} />
                  </div>
                </Field>
                <Field label={t('admin.settings.contactPhone')}>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input name="contactPhone" defaultValue={s.contactPhone || ''} className={`${inputClass} pl-9`} />
                  </div>
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              id="pricing"
              title={t('admin.settings.pricing')}
              icon={<DollarSign size={18} />}
              action={<SectionBadge icon={<SlidersHorizontal size={13} />} text={t('admin.settings.dayNightTariffs')} />}
              help={tuple('admin.settings.help.pricing')}
              impactLabel={t('admin.settings.impact')}
              helpOpen={openHelp === 'pricing'}
              onHelpToggle={() => setOpenHelp(openHelp === 'pricing' ? null : 'pricing')}
            >
              <div className="grid gap-6 xl:grid-cols-2">
                <TariffGroup title={t('admin.settings.dayTariff')}>
                  <Field label={t('admin.settings.startFare')}>
                    <MoneyInput name="dayBase" defaultValue={s.dayBase} />
                  </Field>
                  <Field label={t('admin.settings.perKm')}>
                    <MoneyInput name="dayPerKm" defaultValue={s.dayPerKm} />
                  </Field>
                  <Field label={t('admin.settings.perMin')}>
                    <MoneyInput name="dayPerMin" defaultValue={s.dayPerMin} />
                  </Field>
                </TariffGroup>

                <TariffGroup title={t('admin.settings.nightTariff')}>
                  <Field label={t('admin.settings.startFare')}>
                    <MoneyInput name="nightBase" defaultValue={s.nightBase} />
                  </Field>
                  <Field label={t('admin.settings.perKm')}>
                    <MoneyInput name="nightPerKm" defaultValue={s.nightPerKm} />
                  </Field>
                  <Field label={t('admin.settings.perMin')}>
                    <MoneyInput name="nightPerMin" defaultValue={s.nightPerMin} />
                  </Field>
                </TariffGroup>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label={t('admin.settings.workStart')}>
                  <input name="workStart" defaultValue={s.workStart} className={inputClass} />
                </Field>
                <Field label={t('admin.settings.workEnd')}>
                  <input name="workEnd" defaultValue={s.workEnd} className={inputClass} />
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              id="booking"
              title={t('admin.settings.booking')}
              icon={<CalendarClock size={18} />}
              action={<SectionBadge icon={<Car size={13} />} text={bookingModeSummary} />}
              help={tuple('admin.settings.help.booking')}
              impactLabel={t('admin.settings.impact')}
              helpOpen={openHelp === 'booking'}
              onHelpToggle={() => setOpenHelp(openHelp === 'booking' ? null : 'booking')}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label={t('admin.settings.scheduledLead')}>
                  <input
                    name="minScheduledLeadMinutes"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={s.minScheduledLeadMinutes ?? 60}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('admin.settings.minScheduledFare')}>
                  <MoneyInput name="minScheduledPrice" defaultValue={s.minScheduledPrice ?? 0} step="1" />
                </Field>
                <Field label={t('admin.settings.minImmediateFare')}>
                  <MoneyInput name="minImmediatePrice" defaultValue={s.minImmediatePrice ?? 0} step="1" />
                </Field>
                <Field label={t('admin.settings.immediateBooking')}>
                  <select
                    name="allowImmediateBooking"
                    defaultValue={String(Boolean(s.allowImmediateBooking ?? true))}
                    className={inputClass}
                  >
                    <option value="true">{t('admin.settings.enabled')}</option>
                    <option value="false">{t('admin.settings.disabled')}</option>
                  </select>
                </Field>
                <Field label={t('admin.settings.scheduledBooking')}>
                  <select
                    name="allowScheduledBooking"
                    defaultValue={String(Boolean(s.allowScheduledBooking ?? true))}
                    className={inputClass}
                  >
                    <option value="true">{t('admin.settings.enabled')}</option>
                    <option value="false">{t('admin.settings.disabled')}</option>
                  </select>
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              id="fees"
              title={t('admin.settings.fees')}
              icon={<CreditCard size={18} />}
              action={<SectionBadge icon={<DollarSign size={13} />} text={`${s.discountPercentage || 0}% discount`} />}
              help={tuple('admin.settings.help.fees')}
              impactLabel={t('admin.settings.impact')}
              helpOpen={openHelp === 'fees'}
              onHelpToggle={() => setOpenHelp(openHelp === 'fees' ? null : 'fees')}
            >
              <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                <div className="space-y-4">
                  <Field label={t('admin.settings.discountPercentage')}>
                    <input
                      name="discountPercentage"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      defaultValue={s.discountPercentage || 0}
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t('admin.settings.maxDiscount')}>
                    <MoneyInput name="maxDiscountAmount" defaultValue={s.maxDiscountAmount || 0} />
                  </Field>
                  <Field label={t('admin.settings.immediateCancelFee')}>
                    <MoneyInput name="immediateCancellationFee" defaultValue={s.immediateCancellationFee} />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label={t('admin.settings.scheduledGt2')}>
                    <PercentInput name="scheduledCancellationFee1" defaultValue={s.scheduledCancellationFee1} />
                  </Field>
                  <Field label={t('admin.settings.scheduled1To2')}>
                    <PercentInput name="scheduledCancellationFee2" defaultValue={s.scheduledCancellationFee2} />
                  </Field>
                  <Field label={t('admin.settings.scheduledLt1')}>
                    <PercentInput name="scheduledCancellationFee3" defaultValue={s.scheduledCancellationFee3} />
                  </Field>
                </div>
              </div>
            </SettingsSection>
          </form>

          <SettingsSection
            id="schedule"
            title={t('admin.settings.schedule')}
            icon={<Clock size={18} />}
            action={<SectionBadge icon={<TimerReset size={13} />} text={`${legalMaxDailyMinutes} ${t('admin.settings.dailyCap')}`} />}
            help={tuple('admin.settings.help.schedule')}
            impactLabel={t('admin.settings.impact')}
            helpOpen={openHelp === 'schedule'}
            onHelpToggle={() => setOpenHelp(openHelp === 'schedule' ? null : 'schedule')}
          >
            <form onSubmit={saveSchedulePolicy} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label={t('admin.settings.maxDaily')}>
                  <input
                    name="maxDailyMinutes"
                    type="number"
                    min="60"
                    max={legalMaxDailyMinutes}
                    defaultValue={schedulePolicy?.maxDailyMinutes ?? legalMaxDailyMinutes}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('admin.settings.maxWeekly')}>
                  <input
                    name="maxWeeklyMinutes"
                    type="number"
                    min="60"
                    max="5400"
                    defaultValue={schedulePolicy?.maxWeeklyMinutes ?? 3360}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('admin.settings.minRest')}>
                  <input
                    name="minRestMinutes"
                    type="number"
                    min="0"
                    max="1440"
                    defaultValue={schedulePolicy?.minRestMinutes ?? 660}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('admin.settings.lockBeforeStart')}>
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

              <div className="flex flex-col gap-4 border-t border-gray-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full max-w-xs">
                  <Field label={t('admin.settings.emergencyOverride')}>
                    <select
                      name="allowEmergencyOverride"
                      defaultValue={String(Boolean(schedulePolicy?.allowEmergencyOverride ?? true))}
                      className={inputClass}
                    >
                      <option value="true">{t('admin.settings.enabled')}</option>
                      <option value="false">{t('admin.settings.disabled')}</option>
                    </select>
                  </Field>
                </div>

                <button
                  disabled={savingSchedule}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save size={15} />
                  {savingSchedule ? t('admin.common.saving') : t('admin.settings.saveSchedule')}
                </button>
              </div>
            </form>
          </SettingsSection>
      </main>
    </div>
  );
}

function SettingsSection({
  id,
  title,
  icon,
  action,
  help,
  helpOpen,
  onHelpToggle,
  impactLabel = 'Impact',
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  help?: [string, string, string];
  helpOpen?: boolean;
  onHelpToggle?: () => void;
  impactLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-5 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="relative border-b border-gray-100 px-5 py-4">
        <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-md bg-gray-100 text-gray-700 flex items-center justify-center">{icon}</span>
            <h2 className="text-base font-semibold text-gray-950">{title}</h2>
          </div>
          {action}
        </div>
        {help && (
          <button
            type="button"
            onClick={onHelpToggle}
            aria-label={`Help for ${title}`}
            className={`absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md border text-gray-500 transition ${
              helpOpen
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <HelpCircle size={16} />
          </button>
        )}
        {help && helpOpen && (
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
            <div className="font-semibold">{help[0]}</div>
            <p className="mt-1 leading-6">{help[1]}</p>
            <p className="mt-2 leading-6 text-blue-800">
              <span className="font-medium">{impactLabel}: </span>
              {help[2]}
            </p>
          </div>
        )}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function TariffGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-gray-200 pl-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

function MoneyInput({
  name,
  defaultValue,
  step = '0.01',
}: {
  name: string;
  defaultValue: number;
  step?: string;
}) {
  return (
    <div className="relative">
      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
      <input
        name={name}
        type="number"
        step={step}
        min="0"
        defaultValue={defaultValue}
        className={`${inputClass} pl-9`}
      />
    </div>
  );
}

function PercentInput({ name, defaultValue }: { name: string; defaultValue: number }) {
  return (
    <div className="relative">
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        max="100"
        defaultValue={defaultValue}
        className={`${inputClass} pr-8`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  tone = 'gray',
}: {
  icon: React.ReactNode;
  label: string;
  tone?: 'gray' | 'green';
}) {
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 ${
        tone === 'green'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-gray-200 bg-gray-50 text-gray-600'
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function SectionBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-600">
      {icon}
      {text}
    </span>
  );
}
