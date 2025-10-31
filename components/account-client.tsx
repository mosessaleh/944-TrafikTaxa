"use client";
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  emailVerified: boolean;
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
  paid: boolean;
  createdAt: string;
  vehicleTypeId: number;
  paymentMethod?: string;
}

interface Favorite {
  id: number;
  label: string;
  address: string;
  lat: number | null;
  lon: number | null;
  createdAt: string;
}

export default function AccountClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'profile' | 'history' | 'favorites' || 'profile';
  const [tab, setTab] = useState<'profile' | 'history' | 'favorites'>(initialTab);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [router]);

  // Fetch rides data
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
      onError: (error) => {
      },
    }
  );

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/');
    } catch (error) {
    }
  };

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm('Are you sure you want to cancel this booking? Your payment will be refunded within 3-5 business days.')) {
      return;
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
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">My Account</h1>
          <p className="text-slate-600">Manage your profile and view your booking history</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'profile', label: 'Profile', icon: '👤' },
              { id: 'history', label: 'Booking History', icon: '📋' },
              { id: 'favorites', label: 'Favorite Addresses', icon: '⭐' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {tab === 'profile' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Profile Information</h2>
              <div className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                    <div className="p-3 bg-slate-50 rounded-md text-slate-800">{me.firstName}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <div className="p-3 bg-slate-50 rounded-md text-slate-800">{me.lastName}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <div className="p-3 bg-slate-50 rounded-md text-slate-800 flex items-center gap-2">
                    {me.email}
                    {me.emailVerified ? (
                      <span className="text-green-600 text-sm">✓ Verified</span>
                    ) : (
                      <span className="text-amber-600 text-sm">⚠ Not verified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <div className="p-3 bg-slate-50 rounded-md text-slate-800">{me.phone}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <div className="p-3 bg-slate-50 rounded-md text-slate-800 capitalize">{me.role.toLowerCase()}</div>
                </div>
              </div>
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
                <div className="space-y-2">
                  {ridesData.map((ride: Ride) => (
                    <div key={ride.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-slate-800 text-sm">
                              Booking #{ride.id}
                            </h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              ride.status === 'CONFIRMED' || ride.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                ride.status === 'PENDING' || ride.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                ride.status === 'CANCELED' || ride.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                              {ride.status}
                            </span>
                            {ride.paid && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Paid
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-600">
                            <span>{new Date(ride.createdAt).toLocaleDateString()}</span>
                            <span>{ride.distanceKm.toFixed(1)} km</span>
                            <span>{ride.passengers} passenger{ride.passengers !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-500 truncate">
                                📍 {ride.pickupAddress} → {ride.dropoffAddress}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {ride.scheduled ? '📅 Scheduled' : '🚗 Immediate'}: {new Date(ride.pickupTime).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <div className="text-right mr-4">
                            <p className="font-semibold text-slate-800 text-sm">{ride.price} DKK</p>
                          </div>
                          <div className="flex flex-col gap-1">
                            {(!ride.paymentMethod || ride.paymentMethod === null || ride.paymentMethod === '') &&
                             ride.status !== 'CANCELED' && ride.status !== 'COMPLETED' && (
                              <a
                                href={`/pay?booking_id=${ride.id}`}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                  ride.status === 'PAID' || ride.status === 'CONFIRMED' ||
                                  ride.status === 'REFUNDING' || ride.status === 'REFUNDED'
                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed pointer-events-none'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                              >
                                Pay Now
                              </a>
                            )}
                            {ride.status !== 'CANCELED' && ride.status !== 'COMPLETED' && (
                              <button
                                onClick={() => handleCancelBooking(ride.id)}
                                disabled={ride.status === 'REFUNDING' || ride.status === 'REFUNDED'}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                  ride.status === 'REFUNDING' || ride.status === 'REFUNDED'
                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
                                }
                              } catch (error) {
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
        </div>
      </div>
    </div>
  );
}
