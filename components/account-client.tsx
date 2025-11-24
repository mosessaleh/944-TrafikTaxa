"use client";
import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import ComplaintModal from './ComplaintModal';
import ComplaintConversationModal from './ComplaintConversationModal';
import ProfileEditClient from './profile-edit-client';

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
        Checking receipt/invoice status...
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
          📄 View Receipt/Invoice
        </a>
      </div>
    );
  }

  return (
    <div className="text-sm text-amber-600">
      Receipt/Invoice not available yet
    </div>
  );
}

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
}

interface Ride {
  id: number;
  riderName: string;
  passengers: number;
  pickupAddress: string;
  dropoffAddress: string;
  scheduled: boolean;
  pickupTime: string;
  distanceKm: number;
  durationMin: number;
  price: number;
  status: string;
  paymentStatus: string;
  explanation: string;
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
  const initialTab = searchParams.get('tab') as 'profile' | 'history' | 'favorites' | 'invoices' | 'notifications' || 'profile';
  const [tab, setTab] = useState<'profile' | 'history' | 'favorites' | 'invoices' | 'notifications'>(initialTab);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [complaintModal, setComplaintModal] = useState<{ isOpen: boolean; bookingId: number | null }>({ isOpen: false, bookingId: null });
  const [complaintConversationModal, setComplaintConversationModal] = useState<{ isOpen: boolean; complaint: Complaint | null }>({ isOpen: false, complaint: null });
  const [expandedBooking, setExpandedBooking] = useState<number | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unpaid' | 'overdue'>('all');

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
          throw new Error('Please log in to view your bookings');
        }
        if (response.status === 403) {
          throw new Error('Email verification required');
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
          throw new Error('Please log in to view your favorites');
        }
        if (response.status === 403) {
          throw new Error('Email verification required');
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
          throw new Error('Please log in to view your invoices');
        }
        if (response.status === 403) {
          throw new Error('Email verification required');
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
         throw new Error('Please log in to manage notification settings');
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
     alert('Notification preferences updated.');
   } catch (error) {
     console.error('Failed to update notification settings:', error);
     alert('Failed to update notification preferences. Please try again.');
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
        alert('Booking not found');
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
        ? `Are you sure you want to cancel this booking?\n\nCancellation Fee: ${cancellationFee} DKK\nRefund Amount: ${refundAmount} DKK\n\nYour refund will be processed within 3-5 business days.`
        : 'Are you sure you want to cancel this booking? Your payment will be refunded within 3-5 business days.';

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
        alert('Booking cancelled successfully. You will receive a confirmation email and your refund will be processed within 3-5 business days.');
      } else {
        const errorData = await response.json();
        alert(`Failed to cancel booking: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Failed to cancel booking. Please try again.');
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
        alert('Complaint submitted successfully. We will review it and get back to you.');
        // Refresh the bookings data to show complaint status
        mutateRides();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Complaint submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      alert('Failed to submit complaint. Please try again.');
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
          alert('No complaint found for this booking.');
        }
      } else {
        alert('Failed to load complaint details.');
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
        alert('Reply sent successfully.');
        // Refresh the complaint data by closing and reopening modal
        setComplaintConversationModal({ isOpen: false, complaint: null });
        // Refresh the bookings data to update complaint status
        mutateRides();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply. Please try again.');
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
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Access Denied</h1>
            <p className="text-slate-600 mb-6">Please log in to view your account.</p>
            <button
              onClick={() => router.push('/login')}
              className="btn-primary"
            >
              Go to Login
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
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Account</h1>
          <p className="text-slate-600">Manage your profile, notifications, and booking history</p>
        </div>

        {/* Dashboard Layout: Sidebar + Content */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar */}
          <aside className="w-full lg:w-64">
            <nav className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
              {[
                { id: 'profile', label: 'Profile', icon: '👤' },
                { id: 'history', label: 'Booking History', icon: '📋' },
                { id: 'favorites', label: 'Favorite Addresses', icon: '⭐' },
                { id: 'invoices', label: 'Invoices', icon: '📄' },
                { id: 'notifications', label: 'Notification Preferences', icon: '🔔' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                  </span>
                  {tab === t.id && (
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
              <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
                <div className="grid gap-1">
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-semibold flex items-center gap-2">
                    {me.email}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${me.emailVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {me.emailVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  {!me.emailVerified && (
                    <div className="text-sm text-gray-600">You need to verify your email to book rides or view history.</div>
                  )}
                </div>
              </div>

              <ProfileEditClient initial={{
                email: me.email,
                firstName: me.firstName,
                lastName: me.lastName,
                phone: me.phone,
                address: me.address || '',
                pendingEmail: me.pendingEmail || null
              }} onProfileUpdate={refreshProfile} />

              <div className="mt-8 pt-6 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Booking History</h2>
              {ridesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Loading bookings...</p>
                </div>
              ) : ridesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">Failed to load bookings</p>
                  <p className="text-slate-600 text-sm">{ridesError.message}</p>
                </div>
              ) : !ridesData || ridesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">No bookings found</p>
                  <button
                    onClick={() => router.push('/book')}
                    className="btn-primary mt-4"
                  >
                    Book Your First Ride
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
                                    Route
                                  </h4>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="flex flex-col items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                        <div className="w-0.5 h-8 bg-slate-300"></div>
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                      </div>
                                      <div className="flex-1 space-y-2">
                                        <div>
                                          <p className="text-xs font-medium text-slate-700">From</p>
                                          <p className="text-sm text-slate-600">{ride.pickupAddress}</p>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-slate-700">To</p>
                                          <p className="text-sm text-slate-600">{ride.dropoffAddress}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Trip Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-blue-50 rounded-lg p-3">
                                    <p className="text-xs text-blue-600 font-medium">Distance</p>
                                    <p className="text-base font-bold text-blue-800">{ride.distanceKm?.toFixed(1) || 'N/A'} km</p>
                                  </div>
                                  <div className="bg-purple-50 rounded-lg p-3">
                                    <p className="text-xs text-purple-600 font-medium">Vehicle Type</p>
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
                                    Time Details
                                  </h4>
                                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-600">
                                        {ride.scheduled ? '📅 Scheduled' : '🚗 Immediate'}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-slate-700">Pickup Time</p>
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
                                        <p className="text-xs font-medium text-slate-700">Estimated Duration</p>
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
                                      Payment Method
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
                                      Receipt/Invoice
                                    </h4>
                                    <div className="bg-blue-50 rounded-lg p-3">
                                      <InvoiceActions bookingId={ride.id} />
                                    </div>
                                  </div>
                                )}

                                {/* Status Explanation */}
                                <div>
                                  <h4 className="font-semibold text-slate-700 mb-2">Status</h4>
                                  <div className="bg-slate-50 rounded-lg p-3">
                                    <p className="text-sm text-slate-600">{ride.explanation}</p>
                                  </div>
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
                                      💳 Pay Now
                                    </a>
                                  )}

                                  {/* Cancel Button */}
                                  {(ride.status === 'PENDING' || ride.status === 'CONFIRMED') && (
                                    <button
                                      key={`cancel-${ride.id}`}
                                      onClick={() => handleCancelBooking(ride.id)}
                                      className="w-full sm:w-auto px-4 py-2 text-sm rounded-lg transition-colors font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm"
                                    >
                                      ❌ Cancel
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
                                    {ride.hasComplaint ? '📋 View Complaint' : '📝 Submit Complaint'}
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
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Favorite Addresses</h2>
              {favsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Loading favorites...</p>
                </div>
              ) : favsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">Failed to load favorites</p>
                  <p className="text-slate-600 text-sm">{favsError.message}</p>
                </div>
              ) : !favsData || favsData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">No favorite addresses yet</p>
                  <button
                    onClick={() => router.push('/book')}
                    className="btn-primary mt-4"
                  >
                    Start Booking to Add Favorites
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
                            if (confirm('Remove this favorite address?')) {
                              try {
                                const response = await fetch(`/api/favorites?id=${fav.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                if (response.ok) {
                                  mutateFavs();
                                } else {
                                  alert('Failed to remove favorite address');
                                }
                              } catch (error) {
                                console.error('Failed to remove favorite:', error);
                                alert('Failed to remove favorite address');
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

          {tab === 'invoices' && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Invoices</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInvoiceFilter('all')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setInvoiceFilter('unpaid')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'unpaid'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    }`}
                  >
                    Unpaid
                  </button>
                  <button
                    onClick={() => setInvoiceFilter('overdue')}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      invoiceFilter === 'overdue'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    Overdue
                  </button>
                </div>
              </div>
              {invoicesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Loading invoices...</p>
                </div>
              ) : invoicesError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">Failed to load invoices</p>
                  <p className="text-slate-600 text-sm">{invoicesError.message}</p>
                </div>
              ) : !invoicesData || invoicesData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">No invoices found</p>
                  <p className="text-slate-500 text-sm mt-2">Invoices will appear here when you book with invoice payment method</p>
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
                                <strong>Amount:</strong> {((invoice.ride?.price || 0) + (invoice.lateFee1 || 0) + (invoice.lateFee2 || 0)).toFixed(2)} DKK
                              </p>
                              <p className="text-slate-600">
                                <strong>Due Date:</strong> {effectiveDueDate ? new Date(effectiveDueDate).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-600">
                                <strong>Booking:</strong> #{invoice.rideId}
                              </p>
                              <p className="text-slate-600">
                                <strong>Date:</strong> {new Date(invoice.createdAt).toLocaleDateString()}
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
                            View Invoice
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
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Notification Preferences</h2>
              <p className="text-sm text-slate-600 mb-6">
                Choose which email notifications you want to receive.
              </p>

              {notifSettingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                  <p className="mt-2 text-slate-600">Loading notification settings...</p>
                </div>
              ) : notifSettingsError ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">Failed to load notification settings</p>
                  <p className="text-slate-600 text-sm">{(notifSettingsError as Error).message}</p>
                </div>
              ) : !notifSettingsData ? (
                <div className="text-center py-8">
                  <p className="text-slate-600">Notification settings are not available.</p>
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
                        <div className="font-medium text-slate-800">Booking emails</div>
                        <div className="text-sm text-slate-600">
                          Receive confirmation and status updates for your bookings.
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
                        <div className="font-medium text-slate-800">Payment emails</div>
                        <div className="text-sm text-slate-600">
                          Receive emails when payments are received or updated.
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
                        <div className="font-medium text-slate-800">Invoice emails</div>
                        <div className="text-sm text-slate-600">
                          Receive emails when invoices are generated or updated.
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
                        <div className="font-medium text-slate-800">Marketing emails</div>
                        <div className="text-sm text-slate-600">
                          Receive occasional offers, news, and promotions from 944 Trafik.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-200">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-sm hover:bg-slate-800"
                    >
                      Save preferences
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
