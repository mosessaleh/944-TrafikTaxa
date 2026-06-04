"use client";

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useAdminTranslations } from '@/components/admin-i18n';

type TabKey = 'pending' | 'paid' | 'processing' | 'confirmedActive' | 'completed' | 'canceled' | 'refunding' | 'refunded';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json());

const statusStyles: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PICKED_UP: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELED: 'bg-red-50 text-red-700 border-red-200',
  PROGRESSING: 'bg-blue-50 text-blue-700 border-blue-200',
  CONFIRMED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  REFUNDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REFUNDED: 'bg-violet-50 text-violet-700 border-violet-200',
  PENDING: 'bg-gray-50 text-gray-700 border-gray-200',
  DISPATCHED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ONGOING: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function AdminBookings() {
  const { t, language } = useAdminTranslations();
  const { data, mutate, isLoading } = useSWR('/api/admin/bookings', fetcher, { refreshInterval: 20000 });
  const rides = (data?.rides || []) as any[];

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);
  const [currentTab, setCurrentTab] = useState<TabKey>('pending');
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<any | null>(null);
  const [dispatchDriverId, setDispatchDriverId] = useState('');
  const [dispatchMode, setDispatchMode] = useState<'manual' | 'auto' | null>(null);
  const [dispatchError, setDispatchError] = useState('');

  const groups = useMemo(() => ({
    pending: rides.filter((r) => r.status === 'PENDING' && r.paymentStatus !== 'PAID'),
    paid: rides.filter((r) => r.paymentStatus === 'PAID'),
    processing: rides.filter((r) => r.status === 'PROGRESSING'),
    confirmedActive: rides.filter((r) => ['CONFIRMED', 'DISPATCHED', 'ONGOING', 'PICKED_UP'].includes(r.status)),
    completed: rides.filter((r) => r.status === 'COMPLETED'),
    canceled: rides.filter((r) => r.status === 'CANCELED'),
    refunding: rides.filter((r) => r.status === 'REFUNDING'),
    refunded: rides.filter((r) => r.status === 'REFUNDED'),
  }), [rides]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'pending', label: t('admin.bookings.pending') },
    { key: 'paid', label: t('admin.bookings.paid') },
    { key: 'processing', label: t('admin.bookings.processing') },
    { key: 'confirmedActive', label: t('admin.bookings.active') },
    { key: 'completed', label: t('admin.bookings.completed') },
    { key: 'canceled', label: t('admin.bookings.canceled') },
    { key: 'refunding', label: t('admin.bookings.refunding') },
    { key: 'refunded', label: t('admin.bookings.refunded') },
  ];

  useEffect(() => {
    const hash = window.location.hash?.slice(1) as TabKey;
    if (hash && groups[hash]) setCurrentTab(hash);
  }, [groups]);

  const filteredList = useMemo(() => {
    return groups[currentTab].filter((ride: any) => {
      const term = searchTerm.trim().toLowerCase();
      const fullName = `${ride.user?.firstName || ''} ${ride.user?.lastName || ''}`.toLowerCase();
      const matchesSearch = !term ||
        String(ride.id).includes(term) ||
        fullName.includes(term) ||
        String(ride.user?.email || '').toLowerCase().includes(term) ||
        String(ride.user?.phone || '').toLowerCase().includes(term) ||
        String(ride.pickupAddress || '').toLowerCase().includes(term) ||
        String(ride.dropoffAddress || '').toLowerCase().includes(term);

      const created = new Date(ride.createdAt);
      const today = new Date();
      const matchesDate = dateFilter === 'all' ||
        (dateFilter === 'today' && created.toDateString() === today.toDateString()) ||
        (dateFilter === 'week' && created >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) ||
        (dateFilter === 'month' && created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear());

      const matchesStatus = statusFilter === 'all' || ride.status === statusFilter;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [currentTab, dateFilter, groups, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const needsAction = rides.filter((r) => r.status === 'PENDING' || (r.paymentStatus !== 'PAID' && r.status !== 'CANCELED')).length;
    return {
      total: rides.length,
      today: rides.filter((r) => new Date(r.createdAt).toDateString() === today).length,
      needsAction,
      active: groups.confirmedActive.length,
      revenue: rides.filter((r) => r.paymentStatus === 'PAID').reduce((sum, r) => sum + Number(r.price || 0), 0),
    };
  }, [groups.confirmedActive.length, rides]);

  function switchTab(key: TabKey) {
    setCurrentTab(key);
    window.location.hash = key;
    setSelectedBookings([]);
  }

  function openDispatchModal(ride: any) {
    setDispatchTarget(ride);
    setDispatchDriverId(ride?.driverId ? String(ride.driverId) : '');
    setDispatchError('');
    setDispatchMode(null);
  }

  function closeDispatchModal() {
    setDispatchTarget(null);
    setDispatchDriverId('');
    setDispatchError('');
  }

  async function submitDispatch(mode: 'manual' | 'auto') {
    if (!dispatchTarget) return;

    if (mode === 'manual') {
      const parsedDriverId = Number(dispatchDriverId);
      if (!Number.isInteger(parsedDriverId) || parsedDriverId <= 0) {
        setDispatchError(t('admin.bookings.dispatchDriverInvalid', 'Enter a valid driver ID.'));
        return;
      }
    }

    setDispatchMode(mode);
    setDispatchError('');

    try {
      const res = await fetch('/api/admin/bookings/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'manual'
            ? { id: dispatchTarget.id, mode, driverId: Number(dispatchDriverId) }
            : { id: dispatchTarget.id, mode }
        ),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDispatchError(body.error || t('admin.bookings.dispatchFailed', 'Dispatch failed.'));
        return;
      }

      await mutate();

      if (selectedRide?.id === dispatchTarget.id && body?.ride) {
        setSelectedRide((prev: any) => prev?.id === body.ride.id ? { ...prev, ...body.ride } : prev);
      }

      closeDispatchModal();
      if (body?.message) {
        alert(body.message);
      }
    } catch (error) {
      setDispatchError(t('admin.bookings.dispatchFailed', 'Dispatch failed.'));
    } finally {
      setDispatchMode(null);
    }
  }

  async function applyAction(id: number, action: string) {
    if (!confirm(`${t('admin.bookings.confirmAction')} #${id}?`)) return;
    const res = await fetch('/api/admin/bookings/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Action failed');
      return;
    }
    await mutate();
    setSelectedRide(null);
  }

  async function handleBulkAction(action: string) {
    if (selectedBookings.length === 0) return;
    if (!confirm(t('admin.bookings.bulkConfirm'))) return;

    for (const id of selectedBookings) {
      await fetch('/api/admin/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
    }
    setSelectedBookings([]);
    mutate();
  }

  function exportToCSV() {
    const headers = ['ID', 'User', 'Pickup', 'Stop', 'Dropoff', 'Time', 'Price', 'Status', 'Payment', 'Method'];
    const rows = filteredList.map((ride) => [
      ride.id,
      `${ride.user?.firstName || ''} ${ride.user?.lastName || ''}`,
      ride.pickupAddress,
      ride.stopAddress || '',
      ride.dropoffAddress,
      new Date(ride.pickupTime).toLocaleString(),
      ride.price,
      ride.status,
      ride.paymentStatus,
      ride.paymentMethod || 'N/A',
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${currentTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 px-4 py-6">
      <header className="rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-950">{t('admin.bookings.title')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('admin.bookings.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => mutate()} className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RefreshCw size={15} />
              {t('admin.common.refresh')}
            </button>
            <button onClick={exportToCSV} className="inline-flex h-9 items-center gap-2 rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800">
              <Download size={15} />
              {t('admin.common.exportCsv')}
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label={t('admin.bookings.total')} value={stats.total} icon={<Clock size={18} />} />
        <Metric label={t('admin.bookings.today')} value={stats.today} icon={<Calendar size={18} />} />
        <Metric label={t('admin.bookings.needsAction')} value={stats.needsAction} icon={<MoreHorizontal size={18} />} tone="amber" />
        <Metric label={t('admin.bookings.active')} value={stats.active} icon={<CheckCircle size={18} />} tone="green" />
        <Metric label={t('admin.bookings.revenue')} value={`${stats.revenue.toFixed(0)} DKK`} icon={<CreditCard size={18} />} />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                  currentTab === tab.key
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`rounded px-1.5 py-0.5 text-xs ${currentTab === tab.key ? 'bg-white/15' : 'bg-gray-100 text-gray-600'}`}>
                  {groups[tab.key].length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`${t('admin.common.search')}...`}
              className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterSelect value={dateFilter} onChange={setDateFilter} icon={<Calendar size={15} />}>
              <option value="all">{t('admin.bookings.allDates')}</option>
              <option value="today">{t('admin.bookings.today')}</option>
              <option value="week">{t('admin.bookings.thisWeek')}</option>
              <option value="month">{t('admin.bookings.thisMonth')}</option>
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={setStatusFilter} icon={<Filter size={15} />}>
              <option value="all">{t('admin.bookings.allStatuses')}</option>
              {['PENDING', 'PROGRESSING', 'CONFIRMED', 'DISPATCHED', 'ONGOING', 'COMPLETED', 'CANCELED', 'REFUNDING', 'REFUNDED'].map((status) => (
                <option key={status} value={status}>{formatStatus(status)}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {selectedBookings.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-blue-800">{selectedBookings.length} {t('admin.bookings.selected')}</span>
            <div className="flex flex-wrap gap-2">
              <ActionButton label={t('admin.common.confirm')} icon={<CheckCircle size={14} />} onClick={() => handleBulkAction('CONFIRM')} />
              <ActionButton label={t('admin.common.cancel')} icon={<XCircle size={14} />} onClick={() => handleBulkAction('CANCEL')} danger />
              <ActionButton label={t('admin.bookings.markPaid')} icon={<CreditCard size={14} />} onClick={() => handleBulkAction('MARK_PAID')} />
              <button onClick={() => setSelectedBookings([])} className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600 hover:bg-gray-50">{t('admin.common.clear')}</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-gray-100 bg-white text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedBookings.length === filteredList.length && filteredList.length > 0}
                    onChange={(e) => setSelectedBookings(e.target.checked ? filteredList.map((r) => r.id) : [])}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">{t('admin.bookings.bookingId')}</th>
                <th className="px-4 py-3">{t('admin.bookings.pickup')}</th>
                <th className="px-4 py-3">{t('admin.bookings.customer')}</th>
                <th className="px-4 py-3">{t('admin.bookings.route')}</th>
                <th className="px-4 py-3">{t('admin.bookings.price')}</th>
                <th className="px-4 py-3">{t('admin.bookings.status')}</th>
                <th className="px-4 py-3">{t('admin.bookings.payment')}</th>
                <th className="px-4 py-3 text-right">{t('admin.common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">Loading...</td></tr>
              )}
              {!isLoading && filteredList.map((ride: any) => (
                <tr key={ride.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedBookings.includes(ride.id)}
                      onChange={(e) => {
                        setSelectedBookings((prev) => e.target.checked ? [...prev, ride.id] : prev.filter((id) => id !== ride.id));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-950">#{ride.id}</div>
                    <div className="text-xs text-gray-500">{formatDate(ride.createdAt, language)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{formatDate(ride.pickupTime, language)}</div>
                    <div className="text-xs text-gray-500">{formatTime(ride.pickupTime, language)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                        <User size={15} />
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{displayName(ride)}</div>
                        <div className="text-xs text-gray-500">{ride.user?.email || '-'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="max-w-sm px-4 py-3">
                    <RoutePreview ride={ride} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-950">{Number(ride.price || 0).toFixed(2)} DKK</td>
                  <td className="px-4 py-3"><StatusBadge status={ride.status} /></td>
                  <td className="px-4 py-3"><PaymentBadge ride={ride} /></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setSelectedRide(ride)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                        <MoreHorizontal size={14} />
                        {t('admin.common.details')}
                      </button>
                      <QuickAction ride={ride} t={t} onAction={applyAction} onDispatch={openDispatchModal} />
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <Search size={30} className="text-gray-300" />
                      <div className="mt-3 font-medium text-gray-900">{t('admin.common.noResults')}</div>
                      <button onClick={() => { setSearchTerm(''); setDateFilter('all'); setStatusFilter('all'); }} className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700">
                        {t('admin.common.clearFilters')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRide && (
        <BookingModal
          ride={selectedRide}
          t={t}
          language={language}
          onClose={() => setSelectedRide(null)}
          onAction={applyAction}
          onDispatch={openDispatchModal}
        />
      )}

      {dispatchTarget && (
        <DispatchRideModal
          ride={dispatchTarget}
          t={t}
          driverId={dispatchDriverId}
          busyMode={dispatchMode}
          error={dispatchError}
          onClose={closeDispatchModal}
          onChangeDriverId={setDispatchDriverId}
          onManualDispatch={() => submitDispatch('manual')}
          onAutoDispatch={() => submitDispatch('auto')}
        />
      )}
    </div>
  );
}

function Metric({ label, value, icon, tone = 'blue' }: { label: string; value: string | number; icon: React.ReactNode; tone?: 'blue' | 'green' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${colors[tone]}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-950">{value}</div>
    </div>
  );
}

function FilterSelect({ value, onChange, icon, children }: { value: string; onChange: (value: string) => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-md border border-gray-200 bg-white pl-9 pr-8 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
        {children}
      </select>
    </div>
  );
}

function QuickAction({ ride, t, onAction, onDispatch }: { ride: any; t: (path: string) => string; onAction: (id: number, action: string) => void; onDispatch: (ride: any) => void }) {
  const action = ride.status === 'PENDING'
    ? { key: 'CONFIRM', label: t('admin.common.confirm'), icon: <CheckCircle size={14} /> }
    : ride.status === 'CONFIRMED'
      ? { key: 'DISPATCH', label: t('admin.bookings.dispatch'), icon: <Send size={14} /> }
      : ['DISPATCHED', 'ONGOING', 'PICKED_UP'].includes(ride.status)
        ? { key: 'DELIVERED', label: t('admin.bookings.delivered'), icon: <CheckCircle size={14} /> }
        : null;

  if (!action) return null;

  return (
    <button
      onClick={() => action.key === 'DISPATCH' ? onDispatch(ride) : onAction(ride.id, action.key)}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
    >
      {action.icon}
      {action.label}
    </button>
  );
}

function BookingModal({ ride, t, language, onClose, onAction, onDispatch }: { ride: any; t: (path: string, fallback?: string) => string; language: string; onClose: () => void; onAction: (id: number, action: string) => void; onDispatch: (ride: any) => void }) {
  const actions = getBookingActions(ride, t);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500">{t('admin.bookings.bookingId')} #{ride.id}</div>
              <h2 className="truncate text-lg font-semibold text-gray-950">{displayName(ride)}</h2>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-73px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label={t('admin.bookings.status')} value={formatStatus(ride.status)} />
                <InfoBox label={t('admin.bookings.payment')} value={ride.paymentStatus || '-'} />
                <InfoBox label={t('admin.bookings.pickup')} value={`${formatDate(ride.pickupTime, language)} ${formatTime(ride.pickupTime, language)}`} />
                <InfoBox label={t('admin.bookings.price')} value={`${Number(ride.price || 0).toFixed(2)} DKK`} />
              </div>

              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{t('admin.bookings.route')}</h3>
                <div className="mt-3">
                  <RoutePreview ride={ride} expanded />
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{t('admin.bookings.passenger')}</h3>
                <div className="mt-3 space-y-1 text-sm text-gray-600">
                  <div>{displayName(ride)}</div>
                  <div>{ride.user?.email || '-'}</div>
                  <div>{ride.user?.phone || '-'}</div>
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('admin.common.actions')}</h3>
              <div className="mt-3 grid gap-2">
                {actions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => action.key === 'DISPATCH' ? onDispatch(ride) : onAction(ride.id, action.key)}
                    className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium ${
                      action.key === 'DISPATCH'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : action.key === 'CANCEL'
                          ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <action.Icon size={15} />
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatchRideModal({
  ride,
  t,
  driverId,
  busyMode,
  error,
  onClose,
  onChangeDriverId,
  onManualDispatch,
  onAutoDispatch,
}: {
  ride: any;
  t: (path: string, fallback?: string) => string;
  driverId: string;
  busyMode: 'manual' | 'auto' | null;
  error: string;
  onClose: () => void;
  onChangeDriverId: (value: string) => void;
  onManualDispatch: () => void;
  onAutoDispatch: () => void;
}) {
  const isBusy = Boolean(busyMode);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={() => { if (!isBusy) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-950">
              {t('admin.bookings.dispatchModalTitle', 'Dispatch ride')} #{ride.id}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {ride.scheduled
                ? t('admin.bookings.dispatchModalScheduled', 'Assign a driver for this scheduled ride or let the system handle it automatically.')
                : t('admin.bookings.dispatchModalImmediate', 'Send this ride to a specific driver or ask the system to find the nearest available car.')}
            </p>
          </div>
          <button onClick={onClose} disabled={isBusy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">{displayName(ride)}</div>
            <div className="mt-1 text-sm text-gray-600">{ride.pickupAddress}</div>
            <div className="text-sm text-gray-500">{ride.dropoffAddress}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {t('admin.bookings.dispatchDriverId', 'Driver ID')}
            </label>
            <input
              type="number"
              min="1"
              value={driverId}
              onChange={(e) => onChangeDriverId(e.target.value)}
              placeholder={t('admin.bookings.dispatchDriverPlaceholder', 'Enter driver ID')}
              className="h-11 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={onManualDispatch}
              disabled={isBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} className={busyMode === 'manual' ? 'animate-spin' : ''} />
              {busyMode === 'manual'
                ? t('admin.bookings.dispatchSending', 'Sending...')
                : t('admin.bookings.dispatchSendToDriver', 'Send to driver')}
            </button>

            <button
              onClick={onAutoDispatch}
              disabled={isBusy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={busyMode === 'auto' ? 'animate-spin' : ''} />
              {busyMode === 'auto'
                ? t('admin.bookings.dispatchSearching', 'Searching...')
                : t('admin.bookings.dispatchAutoSearch', 'Auto search')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoutePreview({ ride, expanded = false }: { ride: any; expanded?: boolean }) {
  return (
    <div className={`space-y-2 ${expanded ? '' : 'text-xs'}`}>
      <RouteLine color="bg-emerald-500" text={ride.pickupAddress || '-'} />
      {ride.stopAddress && <RouteLine color="bg-amber-500" text={ride.stopAddress} />}
      <RouteLine color="bg-red-500" text={ride.dropoffAddress || '-'} />
    </div>
  );
}

function RouteLine({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-gray-600">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} />
      <span className="line-clamp-1" title={text}>{text}</span>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-950">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[status] || statusStyles.PENDING}`}>
      {formatStatus(status)}
    </span>
  );
}

function PaymentBadge({ ride }: { ride: any }) {
  const paid = ride.paymentStatus === 'PAID';
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${paid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
        {paid ? 'PAID' : ride.paymentStatus || 'UNPAID'}
      </span>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <CreditCard size={12} />
        {String(ride.paymentMethod || 'N/A').toLowerCase()}
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, danger = false }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
      {icon}
      {label}
    </button>
  );
}

function getBookingActions(ride: any, t: (path: string) => string) {
  const actions: Array<{ key: string; label: string; Icon: any }> = [];

  if (ride.status === 'PENDING') {
    actions.push({ key: 'CONFIRM', label: t('admin.common.confirm'), Icon: CheckCircle });
  }

  if (ride.status === 'CONFIRMED') {
    actions.push({ key: 'DISPATCH', label: t('admin.bookings.dispatch'), Icon: Send });
  }

  if (ride.paymentStatus !== 'PAID' && !['CANCELED', 'REFUNDED'].includes(ride.status)) {
    actions.push({ key: 'MARK_PAID', label: t('admin.bookings.markPaid'), Icon: CreditCard });
  }

  if (['DISPATCHED', 'ONGOING', 'PICKED_UP'].includes(ride.status)) {
    actions.push({ key: 'DELIVERED', label: t('admin.bookings.delivered'), Icon: CheckCircle });
  }

  if (ride.status === 'DELIVERED') {
    actions.push({ key: 'COMPLETE', label: t('admin.bookings.complete'), Icon: CheckCircle });
  }

  if (ride.status === 'COMPLETED') {
    actions.push({ key: 'REFUNDING', label: t('admin.bookings.refundProgress'), Icon: RefreshCw });
  }

  if (ride.status === 'REFUNDING') {
    actions.push({ key: 'REFUNDED', label: t('admin.bookings.markRefunded'), Icon: CheckCircle });
  }

  if (!['CANCELED', 'COMPLETED', 'REFUNDED'].includes(ride.status)) {
    actions.push({ key: 'CANCEL', label: t('admin.common.cancel'), Icon: XCircle });
  }

  return actions;
}

function displayName(ride: any) {
  const name = `${ride.user?.firstName || ''} ${ride.user?.lastName || ''}`.trim();
  return name || ride.passengerName || ride.riderName || '-';
}

function formatStatus(status: string) {
  return String(status || '').replace(/_/g, ' ');
}

function formatDate(value: string, language: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(language === 'ar' ? 'ar' : language === 'dk' ? 'da-DK' : 'en-US');
}

function formatTime(value: string, language: string) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString(language === 'ar' ? 'ar' : language === 'dk' ? 'da-DK' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}
