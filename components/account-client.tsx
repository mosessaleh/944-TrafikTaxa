"use client";
import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import ComplaintModal from './ComplaintModal';
import ComplaintConversationModal from './ComplaintConversationModal';
import ProfileEditClient from './profile-edit-client';
import PaymentMethodsClient from './payment-methods-client';

// Import translation files
import dkMessages from '../messages/dk.json';
import enMessages from '../messages/en.json';

// Translation function
function useTranslations(user: User | null) {
  const [language, setLanguage] = useState('dk');

  useEffect(() => {
    // Priority: user database language > localStorage > default 'dk'
    if (user?.language) {
      setLanguage(user.language);
    } else {
      const saved = localStorage.getItem('language') || 'dk';
      setLanguage(saved);
    }

    // Listen for storage changes (when other components change language)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'language') {
        setLanguage(e.newValue || 'dk');
      }
    };

    // Listen for custom language change events
    const handleLanguageChange = (e: CustomEvent) => {
      setLanguage(e.detail || 'dk');
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('languageChange' as any, handleLanguageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChange' as any, handleLanguageChange);
    };
  }, [user]);

  const t = (key: string) => {
    const keys = key.split('.');
    const messages = language === 'dk' ? dkMessages : enMessages;
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return t;
}

// Invoice Actions Component (moved inside AccountClient to access t)

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  emailVerified: boolean;
  address: string;
  pendingEmail: string | null;
  language?: string;
}

interface Ride {
  id: number;
  riderName: string;
  passengers: number;
  pickupAddress: string;
  dropoffAddress: string;
  stopAddress?: string | null;
  scheduled: boolean;
  pickupTime: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  status: string;
  paymentStatus: string;
  explanation: string;
  cancellationReason?: string | null;
  canceledBy?: string | null;
  paymentMethod?: string;
  createdAt: string;
  vehicleTypeId: number;
  vehicleType?: {
    title: string;
    capacity: number;
  };
  hasComplaint?: boolean;
  complaintStatus?: string | null;
}

interface Favorite {
  id: number;
  label: string;
  address: string;
  lat: number | null;
  lon: number | null;
  createdAt: string;
}

interface Complaint {
  id: number;
  rideId: number;
  complaint: string;
  status: string;
  adminDecision: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  userId: number;
  rideId: number;
  dueDate: string;
  paymentStatus: string;
  status: number;
  createdAt: string;
  lateFee1?: number;
  lateFee2?: number;
  extendedDueDate?: string;
  ride?: {
    price: number;
  };
}

interface NotificationSettings {
  emailBooking: boolean;
  emailPayment: boolean;
  emailInvoice: boolean;
  emailMarketing: boolean;
}

export default function AccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'profile' | 'history' | 'favorites' | 'payment-methods' | 'invoices' | 'notifications' || 'profile';
  const [tab, setTab] = useState<'profile' | 'history' | 'favorites' | 'payment-methods' | 'invoices' | 'notifications'>(initialTab);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [complaintModal, setComplaintModal] = useState<{ isOpen: boolean; bookingId: number | null }>({ isOpen: false, bookingId: null });
  const [complaintConversationModal, setComplaintConversationModal] = useState<{ isOpen: boolean; complaint: Complaint | null }>({ isOpen: false, complaint: null });
  const [expandedBooking, setExpandedBooking] = useState<number | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'overdue'>('all');

  const t = useTranslations(me);

  // Invoice Actions Component
  function InvoiceActions({ bookingId }: { bookingId: number }) {
    const [invoiceStatus, setInvoiceStatus] = useState<'loading' | 'available' | 'not_available'>('loading');
    const [invoiceId, setInvoiceId] = useState<number | null>(null);

    useEffect(() => {
      const checkInvoice = async () => {
        try {
          // First, get the invoice ID by checking the invoices API
          const invoiceResponse = await fetch(`/api/bookings/${bookingId}/invoice-id`, {
            method: 'GET',
            credentials: 'include',
          });

          if (invoiceResponse.ok) {
            const invoiceData = await invoiceResponse.json();
            setInvoiceId(invoiceData.invoiceId);
            setInvoiceStatus('available');
          } else {
            setInvoiceStatus('not_available');
          }
        } catch (error) {
          console.error('Error checking invoice:', error);
          setInvoiceStatus('not_available');
        }
      };

      checkInvoice();
    }, [bookingId]);

    if (invoiceStatus === 'loading') {
      return (
        <div className="text-sm text-slate-600">
          {t('account.history.checkingReceipt')}
        </div>
      );
    }

    if (invoiceStatus === 'available' && invoiceId) {
      return (
        <div className="flex gap-3 text-sm">
          <a
            href={`/invoices/${invoiceId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline font-medium"
          >
            {t('account.history.viewReceipt')}
          </a>
        </div>
      );
    }

    return (
      <div className="text-sm text-amber-600">
        {t('account.history.receiptNotAvailable')}
      </div>
    );
  }

  // Fetch user profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/profile', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.ok) {
            setMe(data.me);
          }
        } else if (response.status === 401) {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router, profileRefreshKey]);

  // Function to refresh profile data
  const refreshProfile = () => {
    setProfileRefreshKey(prev => prev + 1);
  };

  // Fetch rides data with complaint status
  const { data: ridesData, error: ridesError, isLoading: ridesLoading, mutate: mutateRides } = useSWR(
    tab === 'history' && me ? '/api/bookings' : null,
    async (url) => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });


      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t('account.history.loginRequiredBookings'));
        }
        if (response.status === 403) {
          throw new Error(t('account.history.emailVerificationRequired'));
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch bookings: ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch bookings');
      }

      return data.rides || [];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      errorRetryCount: 1,
      errorRetryInterval: 1000,
      shouldRetryOnError: false,
      onError: (error) => {
      },
    }
  );

  // Fetch favorites data
  const { data: favsData, error: favsError, mutate: mutateFavs, isLoading: favsLoading } = useSWR(
    tab === 'favorites' && me ? '/api/favorites' : null,
    async (url) => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });


      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t('account.favorites.loginRequiredFavorites'));
        }
        if (response.status === 403) {
          throw new Error(t('account.favorites.emailVerificationRequired'));
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch favorites: ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch favorites');
      }

      return data.favorites || [];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      errorRetryCount: 1,
      errorRetryInterval: 1000,
      shouldRetryOnError: false,
    }
  );

  // Fetch invoices data
  const { data: rawInvoicesData, error: invoicesError, mutate: mutateInvoices, isLoading: invoicesLoading } = useSWR(
    tab === 'invoices' && me ? '/api/invoices' : null,
    async (url) => {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t('account.invoices.loginRequiredInvoices'));
        }
        if (response.status === 403) {
          throw new Error(t('account.invoices.emailVerificationRequired'));
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch invoices: ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch invoices');
      }

      return data.invoices || [];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
      errorRetryCount: 1,
      errorRetryInterval: 1000,
      shouldRetryOnError: false,
    }
  );

  // Filter invoices based on selected filter
  const invoicesData = rawInvoicesData?.filter((invoice: Invoice) => {
    const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.paymentStatus !== 'PAID';

    switch (invoiceFilter) {
      case 'unpaid':
        return invoice.paymentStatus !== 'PAID';
      case 'overdue':
        return isOverdue;
      default:
        return true;
    }
  });

 // Fetch notification settings
 const {
   data: notifSettingsData,
   error: notifSettingsError,
   isLoading: notifSettingsLoading,
   mutate: mutateNotifSettings,
 } = useSWR(
   tab === 'notifications' && me ? '/api/profile/notifications' : null,
   async (url) => {
     const response = await fetch(url, {
       method: 'GET',
       credentials: 'include',
       headers: {
         'Content-Type': 'application/json',
         'Cache-Control': 'no-cache',
       },
     });

     if (!response.ok) {
       if (response.status === 401) {
         throw new Error(t('account.notifications.loginRequiredNotifications'));
       }
       const errorData = await response.json().catch(() => ({}));
       throw new Error(errorData.error || `Failed to load notification settings: ${response.status}`);
     }

     const data = await response.json();

     if (!data.ok || !data.settings) {
       throw new Error(data.error || 'Failed to load notification settings');
     }

     return data.settings as NotificationSettings;
   },
   {
     revalidateOnFocus: false,
     revalidateOnReconnect: false,
     dedupingInterval: 5000,
   }
 );

 const handleSaveNotificationSettings = async (e: FormEvent<HTMLFormElement>) => {
   e.preventDefault();

   const formData = new FormData(e.currentTarget);
   const payload = {
     emailBooking: formData.get('emailBooking') === 'on',
     emailPayment: formData.get('emailPayment') === 'on',
     emailInvoice: formData.get('emailInvoice') === 'on',
     emailMarketing: formData.get('emailMarketing') === 'on',
   };

   try {
     const response = await fetch('/api/profile/notifications', {
       method: 'POST',
       credentials: 'include',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(payload),
     });

     if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       throw new Error(errorData.error || 'Failed to update notification settings');
     }

     await mutateNotifSettings();
     alert(t('account.notifications.preferencesUpdated'));
   } catch (error) {
     console.error('Failed to update notification settings:', error);
     alert(t('account.notifications.failedToUpdatePreferences'));
   }
 };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    // Fetch current cancellation fees from settings
    try {
      const settingsResponse = await fetch('/api/settings');
      const settingsData = await settingsResponse.json();
      const settings = settingsData.settings;

      // Find the booking to determine cancellation fee
      const booking = ridesData?.find((r: Ride) => r.id === bookingId);
      if (!booking) {
        alert(t('account.history.bookingNotFound'));
        return;
      }

      // Calculate cancellation fee (simplified logic - full logic is in API)
      let cancellationFee = 0;
      if (booking.scheduled) {
        const pickupTime = new Date(booking.pickupTime);
        const now = new Date();
        const timeDiffHours = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (timeDiffHours >= 2) {
          cancellationFee = (booking.price * (settings?.scheduledCancellationFee1 || 0)) / 100;
        } else if (timeDiffHours >= 1) {
          cancellationFee = (booking.price * (settings?.scheduledCancellationFee2 || 25)) / 100;
        } else if (timeDiffHours > 0) {
          cancellationFee = (booking.price * (settings?.scheduledCancellationFee3 || 50)) / 100;
        }
      } else {
        // Immediate booking
        if (booking.status === 'DISPATCHED' || booking.status === 'ONGOING') {
          cancellationFee = Math.min(settings?.immediateCancellationFee || 50, booking.price);
        }
      }

      const refundAmount = booking.price - cancellationFee;

      const message = cancellationFee > 0
        ? t('account.history.cancelBookingWithFee').replace('{fee}', cancellationFee.toString()).replace('{refund}', refundAmount.toString())
        : t('account.history.cancelBooking');

      if (!confirm(message)) {
        return;
      }
    } catch (error) {
      console.error('Error fetching cancellation fees:', error);
      // Fallback to original message
      if (!confirm('Are you sure you want to cancel this booking? Your payment will be refunded within 3-5 business days.')) {
        return;
      }
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Refresh the bookings data
        mutateRides();
        alert(t('account.history.bookingCancelled'));
      } else {
        const errorData = await response.json();
        alert(t('account.history.failedToCancelBooking').replace('{error}', errorData.error || 'Unknown error'));
      }
    } catch (error) {
      alert(t('account.history.failedToCancelBookingGeneral'));
    }
  };

  const handleSubmitComplaint = async (complaint: string) => {
    if (!complaintModal.bookingId) return;

    try {
      const response = await fetch('/api/complaints', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rideId: complaintModal.bookingId,
          complaint,
        }),
      });

      if (response.ok) {
        alert(t('account.history.complaintSubmittedSuccess'));
        // Refresh the bookings data to show complaint status
        mutateRides();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Complaint submission error:', errorData);
        throw new Error(errorData.error || t('account.history.failedToSubmitComplaint'));
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      alert(t('account.history.failedToSubmitComplaintGeneral'));
      throw error;
    }
  };

  const handleViewComplaint = async (bookingId: number) => {
    try {
      const response = await fetch(`/api/complaints?rideId=${bookingId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.hasComplaint) {
          setComplaintConversationModal({ isOpen: true, complaint: data.complaint });
        } else {
          alert(t('account.history.noComplaintFound'));
        }
      } else {
        alert(t('account.history.failedToLoadComplaint'));
      }
    } catch (error) {
      console.error('Failed to fetch complaint:', error);
      alert('Failed to load complaint details.');
    }
  };

  const handleReplyToComplaint = async (reply: string) => {
    if (!complaintConversationModal.complaint) return;

    try {
      const response = await fetch(`/api/complaints/${complaintConversationModal.complaint.id}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reply }),
      });

      if (response.ok) {
        alert(t('account.history.replySent'));
        // Refresh the complaint data by closing and reopening modal
        setComplaintConversationModal({ isOpen: false, complaint: null });
        // Refresh the bookings data to update complaint status
        mutateRides();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || t('account.history.failedToSendReply'));
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert(t('account.history.failedToSendReply'));
      throw error;
    }
  };

  const toggleBookingExpansion = (bookingId: number) => {
    setExpandedBooking(expandedBooking === bookingId ? null : bookingId);
  };

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [tab, router]);

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading account...</p>
          </div>
        </div>
      </div>
    );
  }


  if (!me) {
    return (
      <div className="min-h-screen pt-20 pb-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">{t('auth.accessDenied')}</h1>
            <p className="text-slate-600 mb-6">{t('auth.loginRequired')}</p>
            <button
              onClick={() => router.push('/login')}
              className="btn-primary"
            >
              {t('auth.goToLogin')}
            </button>
          </div>
        </div>
  
        {complaintModal.isOpen && (
          <ComplaintModal
            isOpen={complaintModal.isOpen}
            onClose={() => setComplaintModal({ isOpen: false, bookingId: null })}
            bookingId={complaintModal.bookingId || 0}
            onSubmit={handleSubmitComplaint}
          />
        )}
  
        {complaintConversationModal.isOpen && (
          <ComplaintConversationModal
            isOpen={complaintConversationModal.isOpen}
            onClose={() => setComplaintConversationModal({ isOpen: false, complaint: null })}
            complaint={complaintConversationModal.complaint}
            onReply={handleReplyToComplaint}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-8 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">{t('account.title')}</h1>
          <p className="text-slate-600">{t('account.subtitle')}</p>
        </div>

        {/* Dashboard Layout: Sidebar + Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar */}
          <aside className="w-full lg:w-64">
            <nav className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
              {[
                { id: 'profile', label: t('account.profile.title'), icon: '👤' },
                { id: 'history', label: t('account.history.title'), icon: '📋' },
                { id: 'payment-methods', label: t('account.paymentMethods.title'), icon: '💳' },
                { id: 'invoices', label: t('account.invoices.title'), icon: '📄' },
                { id: 'favorites', label: t('account.favorites.title'), icon: '⭐' },
                { id: 'notifications', label: t('account.notifications.title'), icon: '🔔' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as any)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === item.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {tab === item.id && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
              {tab === 'profile' && (
                <div className="p-6">
                  <h1 className="text-3xl font-bold mb-6">{t('account.profile.title')}</h1>
   
                  {!me.emailVerified && me.role !== 'ADMIN' && (
                    <div className="grid gap-2 border rounded-xl p-4 bg-orange-50 border-orange-200 mb-6">
                      <div className="font-medium text-orange-800">{t('account.profile.unverified')}</div>
                      <div className="text-sm text-orange-700" dangerouslySetInnerHTML={{ __html: t('account.profile.verifyEmail').replace('{email}', `<b>${me.email}</b>`) }} />
                      <Link href={`/verify?email=${encodeURIComponent(me.email)}`} className="px-4 py-2 rounded-xl border border-orange-300 bg-orange-600 text-white hover:bg-orange-700 transition-colors w-fit">{t('account.profile.sendVerification')}</Link>
                    </div>
                  )}
   
                  <section className="grid gap-4 bg-white border rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="grid gap-1">
                        <div className="text-sm text-gray-500">{t('account.profile.email')}</div>
                        <div className="font-semibold flex items-center gap-2">{me.email} <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${me.emailVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{me.emailVerified ? t('account.profile.verified') : t('account.profile.unverified')}</span></div>
                        {!me.emailVerified && me.role !== 'ADMIN' && (
                          <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: t('account.profile.needVerification').replace('<Link>', `<a href="/verify?email=${encodeURIComponent(me.email)}" class="underline">`).replace('</Link>', '</a>') }} />
                        )}
                      </div>
                    </div>
                  </section>
   
                  <ProfileEditClient initial={{
                    email: me.email,
                    firstName: me.firstName,
                    lastName: me.lastName,
                    phone: me.phone,
                    address: me.address || '',
                    pendingEmail: me.pendingEmail || null,
                    role: me.role
                  }} onProfileUpdate={refreshProfile} />
   
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <button
                      onClick={handleLogout}
                      className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {t('account.profile.logout')}
                    </button>
                  </div>
                </div>
              )}

          {tab === 'history' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('account.history.title')}</h2>

              {/* Check for active ride */}
              {ridesData && ridesData.some((ride: Ride) => ride.status === 'ONGOING' || ride.status === 'DISPATCHED') && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-800">Active Ride</h3>
                      <p className="text-blue-700">You have an active ride in progress.</p>
                    </div>
                    <Link
                      href={`/waiting-for-driver?bookingId=${ridesData.find((ride: Ride) => ride.status === 'ONGOING' || ride.status === 'DISPATCHED')?.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Ride Status
                    </Link>
                  </div>
                </div>
              )}
              {ridesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">{t('account.history.loading')}</p>
                </div>
              ) : ridesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">{t('account.history.error')}</p>
                  <p className="text-slate-600 text-sm">{ridesError.message}</p>
                </div>
              ) : !ridesData || ridesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">{t('account.history.noBookings')}</p>
                  <button
                    onClick={() => router.push('/book')}
                    className="btn-primary mt-4"
                  >
                    {t('account.history.bookFirst')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {ridesData.map((ride: Ride) => {
                    const isExpanded = expandedBooking === ride.id;
                    // console.log(ride) // Debug: removed to clean up code
                    return (
                      <div key={ride.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                        {/* Header - Clickable */}
                        <div
                          className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200 cursor-pointer hover:from-slate-100 hover:to-slate-200 transition-colors"
                          onClick={() => toggleBookingExpansion(ride.id)}
                        >
                          {/* Desktop View */}
                          <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {ride.status === 'COMPLETED' ? '✅' :
                                   ride.status === 'CONFIRMED' ? '🟢' :
                                   ride.status === 'PENDING' ? '🟡' :
                                   ride.status === 'CANCELED' ? '❌' :
                                   ride.status === 'ONGOING' ? '🚗' :
                                   ride.status === 'DISPATCHED' ? '🚗' : '📋'}
                                </span>
                                <div>
                                  <h3 className="font-bold text-slate-800 text-base">
                                    Booking #{ride.id}
                                  </h3>
                                  <p className="text-xs text-slate-600">
                                    {new Date(ride.createdAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  ride.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                  ride.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                                  ride.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  ride.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
                                  ride.status === 'ONGOING' ? 'bg-purple-100 text-purple-800' :
                                  ride.status === 'DISPATCHED' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {ride.status}
                                </span>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  ride.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {ride.paymentStatus === 'PAID' ? '💳 Paid' : '⏳ Unpaid'}
                                </span>
                                {ride.hasComplaint && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    ⚠️ Complaint
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xl font-bold text-slate-800">{Number(ride.price).toFixed(2)} <span className="text-sm">DKK</span></p>
                              </div>
                              <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Mobile View */}
                          <div className="flex sm:hidden items-center justify-between">
                            <div className="flex items-start gap-3">
                              <span className="text-lg">
                                {ride.status === 'COMPLETED' ? '✅' :
                                 ride.status === 'CONFIRMED' ? '🟢' :
                                 ride.status === 'PENDING' ? '🟡' :
                                 ride.status === 'CANCELED' ? '❌' :
                                 ride.status === 'ONGOING' ? '🚗' :
                                 ride.status === 'DISPATCHED' ? '🚗' : '📋'}
                              </span>
                              <div>
                                <h3 className="font-bold text-slate-800 text-xs">
                                  Booking #{ride.id}
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {new Date(ride.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  <span className={ride.status === 'COMPLETED' ? 'text-green-600' :
                                                   ride.status === 'CONFIRMED' ? 'text-blue-600' :
                                                   ride.status === 'PENDING' ? 'text-yellow-600' :
                                                   ride.status === 'CANCELED' ? 'text-red-600' :
                                                   ride.status === 'ONGOING' ? 'text-purple-600' :
                                                   ride.status === 'DISPATCHED' ? 'text-orange-600' :
                                                   'text-gray-600'}>
                                    {ride.status}
                                  </span>
                                  {' • '}
                                  <span className={ride.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-gray-600'}>
                                    {ride.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                                  </span>
                                  {ride.hasComplaint && (
                                    <>
                                      {' • '}
                                      <span className="text-amber-600">Complaint Submitted</span>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-800">{Number(ride.price).toFixed(2)} <span className="text-xs">DKK</span></p>
                              </div>
                              <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Content */}
                        <div className={`overflow-y-auto transition-all duration-300 ease-in-out ${
                          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                        }`}>
                          <div className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Route Info */}
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <span>📍</span>
                                    {t('account.history.route')}
                                  </h4>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="flex flex-col items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <div className="w-0.5 h-6 bg-slate-300"></div>
                                        {ride.stopAddress && (
                                          <>
                                            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                                            <div className="w-0.5 h-6 bg-slate-300"></div>
                                          </>
                                        )}
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                      </div>
                                      <div className="flex-1 space-y-2">
                                        <div>
                                          <p className="text-xs font-medium text-slate-700">{t('account.history.from')}</p>
                                          <p className="text-sm text-slate-600">{ride.pickupAddress}</p>
                                        </div>
                                        {ride.stopAddress && (
                                          <div>
                                            <p className="text-xs font-medium text-slate-700">{t('account.history.stop')}</p>
                                            <p className="text-sm text-slate-600">{ride.stopAddress}</p>
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-xs font-medium text-slate-700">{t('account.history.to')}</p>
                                          <p className="text-sm text-slate-600">{ride.dropoffAddress}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Trip Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <p className="text-xs text-blue-600 font-medium">{t('account.history.distance')}</p>
                                    <p className="text-base font-bold text-blue-800">{ride.distanceKm?.toFixed(1) || 'N/A'} km</p>
                                  </div>
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <p className="text-xs text-purple-600 font-medium">{t('account.history.vehicleType')}</p>
                                    <p className="text-base font-bold text-purple-800">
                                      {ride.vehicleType?.title || 'Standard'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Time & Actions */}
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                    <span>🕐</span>
                                    {t('account.history.timeDetails')}
                                  </h4>
                                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-600">
                                        {ride.scheduled ? t('account.history.scheduled') : t('account.history.immediate')}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700">{t('account.history.pickupTime')}</p>
                                      <p className="text-sm text-slate-600">
                                        {new Date(ride.pickupTime).toLocaleString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                    {ride.durationMin && (
                                      <div>
                                        <p className="text-xs font-medium text-slate-700">{t('account.history.estimatedDuration')}</p>
                                        <p className="text-sm text-slate-600">{ride.durationMin} min</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Payment Method */}
                                {ride.paymentMethod && (
                                  <div>
                                    <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                      <span>💳</span>
                                      {t('account.history.paymentMethod')}
                                    </h4>
                                    <div className="bg-emerald-50 rounded-lg p-3">
                                      <p className="text-sm font-medium text-emerald-700">
                                        {ride.paymentMethod}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Invoice Actions - Show for all paid bookings since we create receipts */}
                                {ride.paymentStatus === 'PAID' && (
                                  <div>
                                    <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                                      <span>📄</span>
                                      {t('account.history.receipt')}
                                    </h4>
                                    <div className="bg-blue-50 rounded-lg p-3">
                                      <InvoiceActions bookingId={ride.id} />
                                    </div>
                                  </div>
                                )}

                                {/* Status Explanation */}
                                <div>
                                  <h4 className="font-semibold text-slate-700 mb-2">{t('account.history.statusExplanation')}</h4>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-sm text-slate-600">{ride.explanation}</p>
                                  </div>
                                </div>

                                {ride.status === 'CANCELED' && (ride.cancellationReason || ride.canceledBy) && (
                                  <div>
                                    <h4 className="font-semibold text-slate-700 mb-2">{t('account.history.cancellationDetails')}</h4>
                                    <div className="bg-red-50 rounded-lg p-3 space-y-2">
                                      {ride.cancellationReason && (
                                        <p className="text-sm text-red-700">
                                          <span className="font-semibold">{t('account.history.cancellationReason')}:</span> {ride.cancellationReason}
                                        </p>
                                      )}
                                      {ride.canceledBy && (
                                        <p className="text-sm text-red-700">
                                          <span className="font-semibold">{t('account.history.canceledBy')}:</span> {t(`account.history.canceledBy_${ride.canceledBy}`)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                                  {t('account.history.complaintHint')}
                                </div>
                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                                  {/* Pay Now Button - Hide if invoice is available */}
                                  {(ride.status === 'PENDING' || ride.status === 'CONFIRMED') && ride.paymentStatus !== 'PAID' && ride.paymentMethod !== 'invoice' && (
                                    <a
                                      key={`pay-${ride.id}`}
                                      href={`/pay?booking_id=${ride.id}`}
                                      className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg transition-colors font-medium bg-green-600 text-white hover:bg-green-700 shadow-sm"
                                    >
                                      {t('account.history.payNow')}
                                    </a>
                                  )}

                                  {/* Cancel Button */}
                                  {(ride.status === 'PENDING' || ride.status === 'CONFIRMED') && (
                                    <button
                                      key={`cancel-${ride.id}`}
                                      onClick={() => handleCancelBooking(ride.id)}
                                      className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg transition-colors font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                    >
                                      {t('account.history.cancel')}
                                    </button>
                                  )}

                                  {/* Complaint Button */}
                                  <button
                                    key={`complaint-${ride.id}`}
                                    onClick={() => ride.hasComplaint ? handleViewComplaint(ride.id) : setComplaintModal({ isOpen: true, bookingId: ride.id })}
                                    className={`w-full sm:w-auto px-4 py-2 text-sm rounded-lg transition-colors font-medium shadow-sm ${
                                      ride.hasComplaint
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-amber-600 text-white hover:bg-amber-700'
                                    }`}
                                  >
                                    {ride.hasComplaint ? t('account.history.viewComplaint') : t('account.history.submitComplaint')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                </div>
              )}
            </div>
          )}

          {tab === 'favorites' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('account.favorites.title')}</h2>
              {favsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">{t('account.favorites.loading')}</p>
                </div>
              ) : favsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">{t('account.favorites.error')}</p>
                  <p className="text-slate-600 text-sm">{favsError.message}</p>
                </div>
              ) : !favsData || favsData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">{t('account.favorites.noFavorites')}</p>
                  <button
                    onClick={() => router.push('/book')}
                    className="btn-primary mt-4"
                  >
                    {t('account.favorites.startBooking')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {favsData.map((fav: Favorite) => (
                    <div key={fav.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 mb-1">{fav.label}</h3>
                          <p className="text-slate-600 text-sm">{fav.address}</p>
                          {fav.lat && fav.lon && (
                            <p className="text-slate-500 text-xs mt-1">
                              {fav.lat.toFixed(4)}, {fav.lon.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm(t('account.favorites.removeFavoriteConfirm'))) {
                              try {
                                const response = await fetch(`/api/favorites?id=${fav.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                if (response.ok) {
                                  mutateFavs();
                                } else {
                                  alert(t('account.favorites.failedToRemoveFavorite'));
                                }
                              } catch (error) {
                                console.error('Failed to remove favorite:', error);
                                alert(t('account.favorites.failedToRemoveFavorite'));
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-700 p-2"
                          title="Remove favorite"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'payment-methods' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('account.paymentMethods.title')}</h2>
              <p className="text-sm text-slate-600 mb-6">
                {t('account.paymentMethods.subtitle')}
              </p>
              <PaymentMethodsClient />
            </div>
          )}

          {tab === 'invoices' && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold text-slate-800">{t('account.invoices.title')}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInvoiceFilter('all')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('account.invoices.all')}
                  </button>
                  <button
                    onClick={() => setInvoiceFilter('unpaid')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'unpaid'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                  >
                    {t('account.invoices.unpaid')}
                  </button>
                  <button
                    onClick={() => setInvoiceFilter('overdue')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'overdue'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {t('account.invoices.overdue')}
                  </button>
                </div>
              </div>
              {invoicesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">{t('account.invoices.loading')}</p>
                </div>
              ) : invoicesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">{t('account.invoices.error')}</p>
                  <p className="text-slate-600 text-sm">{invoicesError.message}</p>
                </div>
              ) : !invoicesData || invoicesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">{t('account.invoices.noInvoices')}</p>
                  <p className="text-slate-500 text-sm mt-2">{t('account.invoices.noInvoicesDesc')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {invoicesData.map((invoice: Invoice) => {
                    // Use extended due date for display, but original due date for overdue check
                    const effectiveDueDate = invoice.extendedDueDate || invoice.dueDate;
                    const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.paymentStatus !== 'PAID';
                    const displayStatus = isOverdue ? 'OVERDUE' : invoice.paymentStatus;
                    const statusColor = isOverdue
                      ? 'bg-red-100 text-red-800'
                      : invoice.paymentStatus === 'PAID'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800';

                    // Determine violation status
                    let violationText = '';
                    if (invoice.lateFee2 && invoice.lateFee2 > 0) {
                      violationText = ' (Second violation sent)';
                    } else if (invoice.lateFee1 && invoice.lateFee1 > 0) {
                      violationText = ' (First violation sent)';
                    }

                    return (
                      <div key={invoice.id} className={`border border-slate-200 rounded-lg p-4 ${isOverdue ? 'bg-red-50' : ''}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-slate-800">{invoice.invoiceNumber}</h3>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                {displayStatus}{violationText}
                              </span>
                            </div>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-slate-600">
                                <strong>{t('account.invoices.amount')}:</strong> {((invoice.ride?.price || 0) + (invoice.lateFee1 || 0) + (invoice.lateFee2 || 0)).toFixed(2)} DKK
                              </p>
                              <p className="text-slate-600">
                                <strong>{t('account.invoices.dueDate')}:</strong> {effectiveDueDate ? new Date(effectiveDueDate).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">
                                <strong>{t('account.invoices.booking')}:</strong> #{invoice.rideId}
                              </p>
                              <p className="text-slate-600">
                                <strong>{t('account.invoices.date')}:</strong> {new Date(invoice.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/invoices/${invoice.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            {t('account.invoices.viewInvoice')}
                          </a>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">{t('account.notifications.title')}</h2>
              <p className="text-sm text-slate-600 mb-6">
                {t('account.notifications.subtitle')}
              </p>

              {notifSettingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">{t('account.notifications.loading')}</p>
                </div>
              ) : notifSettingsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">{t('account.notifications.error')}</p>
                  <p className="text-slate-600 text-sm">{(notifSettingsError as Error).message}</p>
                </div>
              ) : !notifSettingsData ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">{t('account.notifications.notAvailable')}</p>
                </div>
              ) : (
                <form onSubmit={handleSaveNotificationSettings} className="space-y-6 max-w-lg">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailBooking"
                        defaultChecked={notifSettingsData.emailBooking}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <div className="font-medium text-slate-800">{t('account.notifications.bookingEmails')}</div>
                        <div className="text-sm text-slate-600">
                          {t('account.notifications.bookingDesc')}
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailPayment"
                        defaultChecked={notifSettingsData.emailPayment}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <div className="font-medium text-slate-800">{t('account.notifications.paymentEmails')}</div>
                        <div className="text-sm text-slate-600">
                          {t('account.notifications.paymentDesc')}
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailInvoice"
                        defaultChecked={notifSettingsData.emailInvoice}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <div className="font-medium text-slate-800">{t('account.notifications.invoiceEmails')}</div>
                        <div className="text-sm text-slate-600">
                          {t('account.notifications.invoiceDesc')}
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailMarketing"
                        defaultChecked={notifSettingsData.emailMarketing}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <div>
                        <div className="font-medium text-slate-800">{t('account.notifications.marketingEmails')}</div>
                        <div className="text-sm text-slate-600">
                          {t('account.notifications.marketingDesc')}
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800"
                    >
                      {t('account.notifications.savePreferences')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

  {complaintModal.isOpen && (
    <ComplaintModal
      isOpen={complaintModal.isOpen}
      onClose={() => setComplaintModal({ isOpen: false, bookingId: null })}
      bookingId={complaintModal.bookingId || 0}
      onSubmit={handleSubmitComplaint}
    />
  )}

  {complaintConversationModal.isOpen && (
    <ComplaintConversationModal
      isOpen={complaintConversationModal.isOpen}
      onClose={() => setComplaintConversationModal({ isOpen: false, complaint: null })}
      complaint={complaintConversationModal.complaint}
      onReply={handleReplyToComplaint}
    />
  )}
</div>
);
}
