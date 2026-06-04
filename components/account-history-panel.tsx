"use client";

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CarFront,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  MessageSquareWarning,
  Route,
  X,
  XCircle,
} from 'lucide-react';

type Ride = {
  id: number;
  riderName: string;
  passengers: number;
  pickupAddress: string;
  dropoffAddress: string;
  stopAddress?: string | null;
  scheduled: boolean;
  pickupTime: string;
  distanceKm?: number | null;
  durationMin?: number | null;
  price: number;
  status: string;
  paymentStatus: string;
  explanation: string;
  cancellationReason?: string | null;
  canceledBy?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
  vehicleType?: {
    title: string;
    capacity: number;
  };
  hasComplaint?: boolean;
};

type HistoryFilter = 'all' | 'active' | 'upcoming' | 'completed' | 'canceled' | 'unpaid';

type AccountHistoryPanelProps = {
  rides?: Ride[];
  isLoading: boolean;
  error?: { message?: string } | null;
  t: (key: string) => string;
  onBookFirst: () => void;
  onCancelBooking: (bookingId: number) => void | Promise<void>;
  onOpenComplaint: (bookingId: number) => void;
  onViewComplaint: (bookingId: number) => void | Promise<void>;
  renderInvoiceActions: (bookingId: number) => ReactNode;
};

export default function AccountHistoryPanel({
  rides = [],
  isLoading,
  error,
  t,
  onBookFirst,
  onCancelBooking,
  onOpenComplaint,
  onViewComplaint,
  renderInvoiceActions,
}: AccountHistoryPanelProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [selectedRideId, setSelectedRideId] = useState<number | null>(null);

  const activeRide = useMemo(
    () => rides.find((ride) => isActiveRide(ride)) || null,
    [rides]
  );

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: rides.length,
      active: rides.filter((ride) => isActiveRide(ride)).length,
      upcoming: rides.filter((ride) => isUpcomingRide(ride, now)).length,
      unpaid: rides.filter((ride) => ride.paymentStatus !== 'PAID' && ride.status !== 'CANCELED').length,
    };
  }, [rides]);

  const filteredRides = useMemo(() => {
    const now = Date.now();

    return [...rides]
      .filter((ride) => matchesHistoryFilter(ride, filter, now))
      .sort((a, b) => compareRides(a, b, now));
  }, [filter, rides]);

  const selectedRide = useMemo(
    () => rides.find((ride) => ride.id === selectedRideId) || null,
    [rides, selectedRideId]
  );

  const filterItems = [
    { key: 'all' as const, label: t('account.history.filterAll') },
    { key: 'active' as const, label: t('account.history.filterActive') },
    { key: 'upcoming' as const, label: t('account.history.filterUpcoming') },
    { key: 'completed' as const, label: t('account.history.filterCompleted') },
    { key: 'canceled' as const, label: t('account.history.filterCanceled') },
    { key: 'unpaid' as const, label: t('account.history.filterUnpaid') },
  ];

  return (
    <div className="space-y-6 p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef6ff_100%)]">
        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-slate-900">{t('account.history.title')}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HistoryStatCard label={t('account.history.summaryTotal')} value={stats.total} tone="slate" />
            <HistoryStatCard label={t('account.history.summaryActive')} value={stats.active} tone="blue" />
            <HistoryStatCard label={t('account.history.summaryUpcoming')} value={stats.upcoming} tone="emerald" />
            <HistoryStatCard label={t('account.history.summaryUnpaid')} value={stats.unpaid} tone="amber" />
          </div>
        </div>
      </section>

      {activeRide && (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/80 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <CarFront size={16} />
                {t('account.history.activeRideTitle')}
              </div>
              <div className="mt-2 text-sm text-blue-900">
                #{activeRide.id} - {activeRide.pickupAddress}{' -> '}{activeRide.dropoffAddress}
              </div>
              <p className="mt-1 text-sm text-blue-700">{t('account.history.activeRideBody')}</p>
            </div>
            <Link
              href={`/waiting-for-driver?bookingId=${activeRide.id}`}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              {t('account.history.viewRideStatus')}
            </Link>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600" />
          <p className="mt-3 text-sm text-slate-600">{t('account.history.loading')}</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
          <p className="font-medium text-red-700">{t('account.history.error')}</p>
          <p className="mt-2 text-sm text-red-600">{error.message}</p>
        </div>
      ) : rides.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
          <p className="text-slate-700">{t('account.history.noBookings')}</p>
          <button
            onClick={onBookFirst}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            {t('account.history.bookFirst')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {filterItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                  filter === item.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {filteredRides.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <p className="text-slate-700">{t('account.history.noMatches')}</p>
              <button
                onClick={() => setFilter('all')}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                {t('account.history.clearFilters')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => (
                <HistoryListItem
                  key={ride.id}
                  ride={ride}
                  t={t}
                  onOpen={() => setSelectedRideId(ride.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedRide && (
        <HistoryRideModal
          ride={selectedRide}
          t={t}
          onClose={() => setSelectedRideId(null)}
          onCancelBooking={onCancelBooking}
          onOpenComplaint={(bookingId) => {
            setSelectedRideId(null);
            onOpenComplaint(bookingId);
          }}
          onViewComplaint={(bookingId) => {
            setSelectedRideId(null);
            onViewComplaint(bookingId);
          }}
          renderInvoiceActions={renderInvoiceActions}
        />
      )}
    </div>
  );
}

function HistoryStatCard({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'blue' | 'emerald' | 'amber' }) {
  const toneClasses = {
    slate: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function HistoryListItem({ ride, t, onOpen }: { ride: Ride; t: (key: string) => string; onOpen: () => void }) {
  const statusMeta = getStatusMeta(ride.status, t);
  const paymentMeta = getPaymentMeta(ride.paymentStatus, t);

  return (
    <button
      onClick={onOpen}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)_auto] md:items-center">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('account.history.bookingNumber')}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-slate-900">
              #{ride.id}
            </div>
            <span className={`text-[11px] font-medium ${statusMeta.textClass}`}>
              {statusMeta.label}
            </span>
            <span className={`text-[11px] font-medium ${paymentMeta.textClass}`}>
              {paymentMeta.label}
            </span>
          </div>
        </div>

        <div className="min-w-0 md:text-center">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {t('account.history.pickupTime')}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-800">
            {formatDateTime(ride.pickupTime)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="min-w-0 md:text-right">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {t('account.history.amount')}
            </div>
            <div className="mt-1 text-base font-semibold text-slate-900">
              {Number(ride.price).toFixed(2)} DKK
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
}

function HistoryRideModal({
  ride,
  t,
  onClose,
  onCancelBooking,
  onOpenComplaint,
  onViewComplaint,
  renderInvoiceActions,
}: {
  ride: Ride;
  t: (key: string) => string;
  onClose: () => void;
  onCancelBooking: (bookingId: number) => void | Promise<void>;
  onOpenComplaint: (bookingId: number) => void;
  onViewComplaint: (bookingId: number) => void | Promise<void>;
  renderInvoiceActions: (bookingId: number) => ReactNode;
}) {
  const statusMeta = getStatusMeta(ride.status, t);
  const paymentMeta = getPaymentMeta(ride.paymentStatus, t);
  const canPay = canPayRide(ride);
  const canCancel = canCancelRide(ride);
  const canTrack = isActiveRide(ride);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusMeta.badgeClass}>{statusMeta.label}</Badge>
                <Badge className={paymentMeta.badgeClass}>{paymentMeta.label}</Badge>
                {ride.hasComplaint && <Badge className="border-amber-200 bg-amber-50 text-amber-700">{t('account.history.complaint')}</Badge>}
              </div>
              <h3 className="mt-3 truncate text-xl font-semibold text-slate-900">
                {t('account.history.bookingNumber')} #{ride.id}
              </h3>
              <p className="mt-1 text-sm text-slate-500">{t('account.history.bookingCreated')} {formatShortDate(ride.createdAt)}</p>
            </div>

            <div className="flex items-start gap-4">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('account.history.amount')}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{Number(ride.price).toFixed(2)} DKK</div>
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100"
                aria-label={t('account.history.closeDetails')}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(90vh-89px)] overflow-y-auto px-5 py-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <div className="space-y-5">
              <SectionCard title={t('account.history.route')} icon={<Route size={16} />}>
                <RouteSummary ride={ride} t={t} />
              </SectionCard>

              <div className="grid gap-4 sm:grid-cols-2">
                <SectionCard title={t('account.history.timeDetails')} icon={<CalendarClock size={16} />}>
                  <InfoGrid>
                    <InfoRow label={t('account.history.pickupTime')} value={formatDateTime(ride.pickupTime)} />
                    <InfoRow label={t('account.history.tripType')} value={ride.scheduled ? t('account.history.scheduledPlain') : t('account.history.immediatePlain')} />
                    {ride.durationMin ? <InfoRow label={t('account.history.estimatedDuration')} value={`${ride.durationMin} min`} /> : null}
                    <InfoRow label={t('account.history.distance')} value={ride.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : t('account.history.notAvailable')} />
                  </InfoGrid>
                </SectionCard>

                <SectionCard title={t('account.history.details')} icon={<CarFront size={16} />}>
                  <InfoGrid>
                    <InfoRow label={t('account.history.vehicleType')} value={ride.vehicleType?.title || t('account.history.standardVehicle')} />
                    <InfoRow label={t('account.history.paymentMethod')} value={ride.paymentMethod || t('account.history.notAvailable')} />
                    <InfoRow label={t('account.history.paymentStatus')} value={paymentMeta.label} />
                    <InfoRow label={t('account.history.amount')} value={`${Number(ride.price).toFixed(2)} DKK`} />
                  </InfoGrid>
                </SectionCard>
              </div>

              <SectionCard title={t('account.history.statusExplanation')} icon={<AlertCircle size={16} />}>
                <p className="text-sm leading-6 text-slate-600">{ride.explanation}</p>
              </SectionCard>

              {ride.status === 'CANCELED' && (ride.cancellationReason || ride.canceledBy) ? (
                <SectionCard title={t('account.history.cancellationDetails')} icon={<XCircle size={16} />}>
                  <div className="space-y-2 text-sm text-red-700">
                    {ride.cancellationReason ? (
                      <p><span className="font-semibold">{t('account.history.cancellationReason')}:</span> {ride.cancellationReason}</p>
                    ) : null}
                    {ride.canceledBy ? (
                      <p><span className="font-semibold">{t('account.history.canceledBy')}:</span> {t(`account.history.canceledBy_${ride.canceledBy}`)}</p>
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}
            </div>

            <div className="space-y-5">
              {canTrack ? (
                <SectionCard title={t('account.history.activeRideTitle')} icon={<Clock3 size={16} />}>
                  <p className="mb-4 text-sm leading-6 text-slate-600">{t('account.history.activeRideBody')}</p>
                  <Link
                    href={`/waiting-for-driver?bookingId=${ride.id}`}
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    {t('account.history.viewRideStatus')}
                  </Link>
                </SectionCard>
              ) : null}

              {ride.paymentStatus === 'PAID' ? (
                <SectionCard title={t('account.history.receipt')} icon={<FileText size={16} />}>
                  {renderInvoiceActions(ride.id)}
                </SectionCard>
              ) : null}

              <SectionCard title={t('account.history.manageRide')} icon={<MessageSquareWarning size={16} />}>
                <p className="mb-4 text-sm leading-6 text-slate-600">{t('account.history.complaintHint')}</p>
                <div className="grid gap-2">
                  {canPay ? (
                    <a
                      href={`/pay?booking_id=${ride.id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                      {t('account.history.payNow')}
                    </a>
                  ) : null}

                  {canCancel ? (
                    <button
                      onClick={() => onCancelBooking(ride.id)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      {t('account.history.cancel')}
                    </button>
                  ) : null}

                  <button
                    onClick={() => ride.hasComplaint ? onViewComplaint(ride.id) : onOpenComplaint(ride.id)}
                    className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium text-white transition-colors ${
                      ride.hasComplaint ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {ride.hasComplaint ? t('account.history.viewComplaint') : t('account.history.submitComplaint')}
                  </button>
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function MetaItem({ label, value, align = 'start' }: { label: string; value: string; align?: 'start' | 'end' }) {
  return (
    <div className={align === 'end' ? 'text-left sm:text-right' : 'text-left'}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function RouteSummary({ ride, t, compact = false }: { ride: Ride; t: (key: string) => string; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${compact ? 'text-sm' : 'text-sm'}`}>
      <div className="flex flex-col items-center pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="h-6 w-px bg-slate-300" />
        {ride.stopAddress ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="h-6 w-px bg-slate-300" />
          </>
        ) : null}
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <RouteLine label="from" text={ride.pickupAddress} t={t} />
        {ride.stopAddress ? <RouteLine label="stop" text={ride.stopAddress} t={t} /> : null}
        <RouteLine label="to" text={ride.dropoffAddress} t={t} />
      </div>
    </div>
  );
}

function RouteLine({ label, text, t }: { label: 'from' | 'stop' | 'to'; text: string; t: (key: string) => string }) {
  const color = label === 'from' ? 'text-emerald-700' : label === 'stop' ? 'text-amber-700' : 'text-red-700';
  const Icon = MapPin;

  return (
    <div className="min-w-0">
      <div className={`mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${color}`}>
        <Icon size={12} />
        {t(`account.history.${label}`)}
      </div>
      <div className="truncate text-sm text-slate-700">{text}</div>
    </div>
  );
}

function matchesHistoryFilter(ride: Ride, filter: HistoryFilter, now: number) {
  switch (filter) {
    case 'active':
      return isActiveRide(ride);
    case 'upcoming':
      return isUpcomingRide(ride, now);
    case 'completed':
      return ride.status === 'COMPLETED';
    case 'canceled':
      return ride.status === 'CANCELED';
    case 'unpaid':
      return ride.paymentStatus !== 'PAID' && ride.status !== 'CANCELED';
    default:
      return true;
  }
}

function compareRides(a: Ride, b: Ride, now: number) {
  const aRank = getRideRank(a, now);
  const bRank = getRideRank(b, now);
  if (aRank !== bRank) return aRank - bRank;

  const aPickup = new Date(a.pickupTime).getTime();
  const bPickup = new Date(b.pickupTime).getTime();

  if (aRank <= 1) {
    return aPickup - bPickup;
  }

  return bPickup - aPickup;
}

function getRideRank(ride: Ride, now: number) {
  if (isActiveRide(ride)) return 0;
  if (isUpcomingRide(ride, now)) return 1;
  if (ride.status === 'PENDING' || ride.status === 'CONFIRMED') return 2;
  if (ride.status === 'COMPLETED') return 3;
  if (ride.status === 'CANCELED') return 4;
  return 5;
}

function isActiveRide(ride: Ride) {
  return ['DISPATCHED', 'ONGOING', 'PICKED_UP'].includes(ride.status);
}

function isUpcomingRide(ride: Ride, now: number) {
  return new Date(ride.pickupTime).getTime() >= now && ['PENDING', 'CONFIRMED'].includes(ride.status);
}

function canPayRide(ride: Ride) {
  return (ride.status === 'PENDING' || ride.status === 'CONFIRMED') && ride.paymentStatus !== 'PAID' && ride.paymentMethod !== 'invoice';
}

function canCancelRide(ride: Ride) {
  return ride.status === 'PENDING' || ride.status === 'CONFIRMED';
}

function getStatusMeta(status: string, t: (key: string) => string) {
  const key = `account.history.status.${String(status || '').toLowerCase()}`;
  const translated = t(key);
  const label = translated === key ? formatStatus(status) : translated;

  if (status === 'COMPLETED') return { label, badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', textClass: 'text-emerald-700' };
  if (status === 'CONFIRMED') return { label, badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700', textClass: 'text-cyan-700' };
  if (status === 'PENDING') return { label, badgeClass: 'border-amber-200 bg-amber-50 text-amber-700', textClass: 'text-amber-700' };
  if (status === 'CANCELED') return { label, badgeClass: 'border-red-200 bg-red-50 text-red-700', textClass: 'text-red-700' };
  if (status === 'ONGOING' || status === 'PICKED_UP') return { label, badgeClass: 'border-blue-200 bg-blue-50 text-blue-700', textClass: 'text-blue-700' };
  if (status === 'DISPATCHED') return { label, badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700', textClass: 'text-indigo-700' };

  return { label, badgeClass: 'border-slate-200 bg-slate-100 text-slate-700', textClass: 'text-slate-700' };
}

function getPaymentMeta(paymentStatus: string, t: (key: string) => string) {
  if (paymentStatus === 'PAID') {
    return {
      label: t('account.history.paidPlain'),
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      textClass: 'text-emerald-700',
    };
  }

  return {
    label: t('account.history.unpaidPlain'),
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    textClass: 'text-slate-700',
  };
}

function formatStatus(status: string) {
  return String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
