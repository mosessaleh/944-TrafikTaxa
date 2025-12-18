'use client';

import { useEffect, useRef, useState } from 'react';

interface Vehicle {
  id: number;
  regNumber: string;
  lastLat: number | null;
  lastLon: number | null;
  lastLocationUpdate: Date | null;
  vehicleType: string;
  make: string;
  model: string;
  status: string;
  isOnline: boolean;
  isBusy: boolean;
}

export default function AdminMapPage() {
  const mapRef = useRef<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPlate, setSearchPlate] = useState('');
  const [mapInstance, setMapInstance] = useState<any>(null);
  const vehicleMarkersRef = useRef<Map<number, any>>(new Map());
  const previousLocationsRef = useRef<Map<string, {lat: number, lon: number}>>(new Map());

  // Initialize Google Maps
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || mapInstance) return;

      // Load Google Maps API if not already loaded
      if (!(window as any).google) {
        // Load Google Maps API with callback
        (window as any).initGoogleMapsAdmin = () => {
          // Google Maps loaded callback
          console.log('Google Maps API loaded for admin');
        };

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&language=da&callback=initGoogleMapsAdmin`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        // Wait for Google Maps API to load
        await new Promise((resolve, reject) => {
          const checkGoogle = () => {
            if ((window as any).google) {
              resolve(null);
            } else {
              setTimeout(checkGoogle, 100);
            }
          };
          checkGoogle();
        });
      }

      const google = (window as any).google;

      // Check if map container already has a map
      const mapContainer = document.getElementById('admin-map');
      if (!mapContainer) return;

      // Create map centered on Denmark
      const map = new google.maps.Map(mapContainer, {
        center: { lat: 56.2639, lng: 9.5018 }, // Denmark center
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      mapRef.current = map;

      setMapInstance(map);
    };

    initializeMap();
  }, [mapInstance]);

  // Load vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      console.log('🏁 Loading initial vehicle data...');
      try {
        const response = await fetch('/api/admin/vehicles/map');
        const data = await response.json();
        if (data.ok) {
          console.log(`📦 Initial load: ${data.vehicles.length} vehicles from database`);
          setVehicles(data.vehicles);
        } else {
          console.error('❌ Initial load failed:', data.error);
        }
      } catch (error) {
        console.error('❌ Initial load error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVehicles();
  }, []);

  // Update map markers when vehicles change
  useEffect(() => {
    if (!mapInstance) return;

    console.log('🗺️ Updating map markers for', vehicles.length, 'vehicles');

    const google = (window as any).google;

    // Clear existing markers
    vehicleMarkersRef.current.forEach(marker => {
      marker.setMap(null);
    });
    vehicleMarkersRef.current.clear();

    // Track first vehicle movement
    const firstVehicle = vehicles.find(v => v.lastLat && v.lastLon);
    if (firstVehicle) {
      const prevLocation = previousLocationsRef.current.get(firstVehicle.regNumber);
      if (prevLocation) {
        const latDiff = firstVehicle.lastLat! - prevLocation.lat;
        const lonDiff = firstVehicle.lastLon! - prevLocation.lon;
        console.log(`${firstVehicle.regNumber}: prev(${prevLocation.lat}, ${prevLocation.lon}) -> new(${firstVehicle.lastLat}, ${firstVehicle.lastLon}) diff(${latDiff.toFixed(6)}, ${lonDiff.toFixed(6)})`);
      }
      previousLocationsRef.current.set(firstVehicle.regNumber, {
        lat: firstVehicle.lastLat!,
        lon: firstVehicle.lastLon!
      });
    }

    // Add new markers
    vehicles.forEach(vehicle => {
      if (vehicle.lastLat && vehicle.lastLon) {
        let markerColor: string;
        let iconSize: number;
        let containerSize: number;

        if (vehicle.isOnline) {
          if (vehicle.isBusy) {
            // Online but busy - yellow
            markerColor = '#eab308';
            iconSize = 16;
            containerSize = 24;
          } else {
            // Online and available - green
            markerColor = '#22c55e';
            iconSize = 16;
            containerSize = 24;
          }
        } else {
          // Offline - red
          markerColor = '#ef4444';
          iconSize = 12;
          containerSize = 18;
        }

        const marker = new google.maps.Marker({
          position: { lat: vehicle.lastLat, lng: vehicle.lastLon },
          map: mapInstance,
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${containerSize}" height="${containerSize}" fill="white" stroke="black" stroke-width="2" rx="6"/><g transform="translate(${containerSize/2 - iconSize/2}, ${containerSize/2 - iconSize/2})"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24"><path d="M5 11l1.5-4.5h11L19 11v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8zM6.5 9l-.5 2h11l-.5-2h-10zM7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="${markerColor}"/></svg></g></svg>`)}`,
            scaledSize: new google.maps.Size(containerSize, containerSize),
            anchor: new google.maps.Point(containerSize / 2, containerSize / 2)
          }
        });

        // Add info window
        const statusText = vehicle.isBusy ? 'Busy' : 'Available';
        const onlineText = vehicle.isOnline ? 'Online' : 'Offline';
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <strong>${vehicle.make} ${vehicle.model}</strong><br>
            License: ${vehicle.regNumber}<br>
            Status: ${statusText}<br>
            Connection: ${onlineText}<br>
            Type: ${vehicle.vehicleType}
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstance, marker);
        });

        vehicleMarkersRef.current.set(vehicle.id, marker);
      }
    });
  }, [vehicles, mapInstance]);

  // Polling for real-time updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log(`🚀 Starting vehicle data polling at ${new Date().toISOString()}...`);

    const interval = setInterval(async () => {
      try {
        console.log('🔄 Fetching vehicle data...');
        const response = await fetch(`/api/admin/vehicles/map?t=${Date.now()}`);
        const data = await response.json();
        if (data.ok) {
          console.log(`📊 Received ${data.vehicles.length} vehicles at ${data.timestamp}`);
          // Force update by creating new array
          const newVehicles = [...data.vehicles];
          console.log('🔄 Setting new vehicles array:', newVehicles.length, 'items');
          setVehicles(newVehicles);
        } else {
          console.error('❌ API returned error:', data.error);
        }
      } catch (error) {
        console.error('❌ Failed to fetch vehicles:', error);
      }
    }, 10000); // Update every 10 seconds

    return () => {
      console.log('🛑 Stopping vehicle data polling...');
      clearInterval(interval);
    };
  }, []);

  // Search for vehicle by license plate
  const handleSearch = () => {
    if (!searchPlate.trim() || !mapInstance) return;

    const vehicle = vehicles.find(v => v.regNumber.toLowerCase().includes(searchPlate.toLowerCase()));
    if (vehicle && vehicle.lastLat && vehicle.lastLon) {
      const marker = vehicleMarkersRef.current.get(vehicle.id);
      if (marker) {
        // Open info window and zoom to vehicle
        const google = (window as any).google;
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <strong>${vehicle.make} ${vehicle.model}</strong><br>
            License: ${vehicle.regNumber}<br>
            Status: ${vehicle.isBusy ? 'Busy' : 'Available'}<br>
            Connection: ${vehicle.isOnline ? 'Online' : 'Offline'}<br>
            Type: ${vehicle.vehicleType}
          `
        });
        infoWindow.open(mapInstance, marker);
        mapInstance.setCenter({ lat: vehicle.lastLat, lng: vehicle.lastLon });
        mapInstance.setZoom(15);
      }
    } else {
      alert('Vehicle not found or no location data');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Map</h1>
        <p className="text-gray-600">Real-time view of all vehicles in Denmark</p>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Search by license plate..."
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm">
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
               <span>Available</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 bg-yellow-500 rounded-full border-2 border-white shadow-sm"></div>
               <span>Busy</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-3 h-3 bg-red-500 rounded-full"></div>
               <span>Offline</span>
             </div>
             <div className="ml-auto text-gray-500">
               {loading ? 'Loading...' : `${vehicles.length} vehicles`}
             </div>
           </div>
        </div>

        <div className="relative">
          <div
            id="admin-map"
            className="h-[600px] w-full rounded-b-lg"
          ></div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-b-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}