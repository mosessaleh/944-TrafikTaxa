"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  paymentMethod?: string;
  createdAt: string;
}

export default function ProfileBookings() {
  const router = useRouter();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch('/api/bookings', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
            return;
          }
          if (response.status === 403) {
            setError('Email verification required to view bookings');
            return;
          }
          throw new Error(`Failed to fetch bookings: ${response.status}`);
        }

        const data = await response.json();
        if (data.ok) {
          setRides(data.rides || []);
        } else {
          throw new Error(data.error || 'Failed to fetch bookings');
        }
      } catch (err) {
        console.error('Failed to fetch bookings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [router]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
        <p className="mt-2 text-slate-600">Loading bookings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">Failed to load bookings</p>
        <p className="text-slate-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!rides || rides.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600">No bookings found</p>
        <button
          onClick={() => router.push('/book')}
          className="btn-primary mt-4"
        >
          Book Your First Ride
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Recent Bookings</h3>
        <button
          onClick={() => router.push('/account?tab=history')}
          className="text-cyan-600 hover:text-cyan-700 text-sm underline"
        >
          View All
        </button>
      </div>
      {rides.slice(0, 3).map((ride) => (
        <div key={ride.id} className="border border-slate-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-semibold text-slate-800">
                Booking #{ride.id}
              </h4>
              <p className="text-sm text-slate-600">
                {new Date(ride.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-800">{ride.price} DKK</p>
              <p className="text-sm text-slate-600 capitalize">{ride.status}</p>
              {ride.paymentMethod && (
                <p className="text-xs text-slate-500 capitalize">{ride.paymentMethod}</p>
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">From:</p>
              <p className="font-medium">{ride.pickupAddress}</p>
            </div>
            <div>
              <p className="text-slate-600">To:</p>
              <p className="font-medium">{ride.dropoffAddress}</p>
            </div>
            <div>
              <p className="text-slate-600">Passengers:</p>
              <p className="font-medium">{ride.passengers}</p>
            </div>
            <div>
              <p className="text-slate-600">Distance:</p>
              <p className="font-medium">{ride.distanceKm.toFixed(1)} km</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
            <p className="text-sm text-slate-600">
              {ride.scheduled ? 'Scheduled for' : 'Booked for'} {new Date(ride.pickupTime).toLocaleString()}
            </p>
            {(!ride.paymentMethod || ride.paymentMethod === null || ride.paymentMethod === '') &&
             ride.status !== 'CANCELED' && ride.status !== 'COMPLETED' && (
              <button
                onClick={() => router.push(`/pay?booking_id=${ride.id}`)}
                disabled={ride.status === 'PAID' || ride.status === 'CONFIRMED' ||
                         ride.status === 'REFUNDING' || ride.status === 'REFUNDED'}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  ride.status === 'PAID' || ride.status === 'CONFIRMED' ||
                  ride.status === 'REFUNDING' || ride.status === 'REFUNDED'
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                Pay Now
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}