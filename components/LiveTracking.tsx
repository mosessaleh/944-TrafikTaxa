'use client';

import { useEffect, useState } from 'react';
import { useRealtime } from './RealtimeProvider';

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

  const getEtaMinutes = (eta: number | null | { timeMinutes?: number | null } | undefined) => {
    if (typeof eta === 'number') {
      return eta;
    }

    if (eta && typeof eta === 'object' && typeof eta.timeMinutes === 'number') {
      return eta.timeMinutes;
    }

    return 0;
  };

  useEffect(() => {
    subscribeToBooking(bookingId);

    return () => {
      // Cleanup is handled by RealtimeProvider.
    };
  }, [bookingId, subscribeToBooking]);

  useEffect(() => {
    const relevantUpdates = bookingUpdates.filter((update) => update.bookingId === bookingId);

    if (relevantUpdates.length === 0) {
      return;
    }

    const latestUpdate = relevantUpdates[relevantUpdates.length - 1];
    setStatus(latestUpdate.status || 'unknown');

    const driverName =
      latestUpdate.driverName ||
      latestUpdate.driver?.name ||
      [latestUpdate.driver?.drFname, latestUpdate.driver?.drLname].filter(Boolean).join(' ').trim();
    const driverPhone = latestUpdate.driverPhone || latestUpdate.driver?.phone || '';
    const etaMinutes = getEtaMinutes(latestUpdate.eta);

    if (driverName) {
      setDriverInfo({
        name: driverName,
        phone: driverPhone,
        eta: etaMinutes,
      });
    }

    if (latestUpdate.location) {
      setCurrentLocation(latestUpdate.location);
    }
  }, [bookingUpdates, bookingId]);

  const getStatusColor = (currentStatus: string) => {
    switch (currentStatus) {
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

  const getStatusText = (currentStatus: string) => {
    switch (currentStatus) {
      case 'confirmed':
        return 'Confirmed';
      case 'dispatched':
        return 'Driver dispatched';
      case 'ongoing':
        return 'Trip in progress';
      case 'completed':
        return 'Trip completed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Live trip tracking</h3>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">{isConnected ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
          {getStatusText(status)}
        </div>
      </div>

      {driverInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Driver information</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium">Name:</span> {driverInfo.name}</p>
            {driverInfo.phone && (
              <p><span className="font-medium">Phone:</span> {driverInfo.phone}</p>
            )}
            {driverInfo.eta > 0 && (
              <p><span className="font-medium">Estimated time:</span> {driverInfo.eta} minutes</p>
            )}
          </div>
        </div>
      )}

      <div className="mb-4">
        <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
          {currentLocation ? (
            <div className="text-center">
              <div className="text-2xl mb-2">Location</div>
              <p className="text-sm text-gray-600">
                Location: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">Map</div>
              <p>Updating location...</p>
            </div>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">Connection lost. Reconnecting...</p>
        </div>
      )}
    </div>
  );
}
