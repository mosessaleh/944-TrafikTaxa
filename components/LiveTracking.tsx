'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from './RealtimeProvider';
import { BookingUpdatePayload } from '@/lib/realtime';

interface LiveTrackingProps {
  bookingId: number;
  className?: string;
}

export default function LiveTracking({ bookingId, className = '' }: LiveTrackingProps) {
  const { subscribeToBooking, bookingUpdates, isConnected } = useRealtime();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [driverInfo, setDriverInfo] = useState<{
    name: string;
    phone: string;
    eta: number;
  } | null>(null);
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    // Subscribe to booking updates
    subscribeToBooking(bookingId);

    return () => {
      // Cleanup will be handled by RealtimeProvider
    };
  }, [bookingId, subscribeToBooking]);

  useEffect(() => {
    // Filter updates for this booking
    const relevantUpdates = bookingUpdates.filter(update => update.bookingId === bookingId);

    if (relevantUpdates.length > 0) {
      const latestUpdate = relevantUpdates[relevantUpdates.length - 1];

      // Update status
      setStatus(latestUpdate.status || 'unknown');

      // Update driver info if available
      if (latestUpdate.driverName) {
        setDriverInfo({
          name: latestUpdate.driverName,
          phone: latestUpdate.driverPhone || '',
          eta: latestUpdate.eta || 0,
        });
      }

      // Update location if available
      if (latestUpdate.location) {
        setCurrentLocation(latestUpdate.location);
      }
    }
  }, [bookingUpdates, bookingId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-blue-600 bg-blue-100';
      case 'dispatched':
        return 'text-orange-600 bg-orange-100';
      case 'ongoing':
        return 'text-green-600 bg-green-100';
      case 'completed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'تم التأكيد';
      case 'dispatched':
        return 'تم إرسال السائق';
      case 'ongoing':
        return 'الرحلة جارية';
      case 'completed':
        return 'تمت الرحلة';
      default:
        return 'في الانتظار';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          تتبع الرحلة المباشر
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'متصل' : 'غير متصل'}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
          {getStatusText(status)}
        </div>
      </div>

      {/* Driver Info */}
      {driverInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">معلومات السائق</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">الاسم:</span> {driverInfo.name}</p>
            {driverInfo.phone && (
              <p><span className="font-medium">الهاتف:</span> {driverInfo.phone}</p>
            )}
            {driverInfo.eta > 0 && (
              <p><span className="font-medium">الوقت المقدر:</span> {driverInfo.eta} دقيقة</p>
            )}
          </div>
        </div>
      )}

      {/* Map Placeholder */}
      <div className="mb-4">
        <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
          {currentLocation ? (
            <div className="text-center">
              <div className="text-2xl mb-2">📍</div>
              <p className="text-sm text-gray-600">
                الموقع: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">🗺️</div>
              <p>جاري تحديث الموقع...</p>
            </div>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ فقد الاتصال. جاري إعادة الاتصال...
          </p>
        </div>
      )}
    </div>
  );
}