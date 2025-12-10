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

  // Initialize Leaflet map
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || mapInstance) return;

      // Load Leaflet CSS if not already loaded
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/leaflet.css';
        document.head.appendChild(link);
      }

      // Load Leaflet JS if not already loaded
      if (!(window as any).L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/leaflet.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;

      // Fix default icon paths
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });

      // Check if map container already has a map
      const mapContainer = document.getElementById('admin-map');
      if (!mapContainer || (mapContainer as any)._leaflet_id) return;

      // Create map centered on Denmark
      const map = L.map('admin-map').setView([56.2639, 9.5018], 7); // Denmark center
      mapRef.current = map;

      // Add tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        crossOrigin: true,
        maxZoom: 19
      }).addTo(map);

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

    const L = (window as any).L;

    // Clear existing markers
    vehicleMarkersRef.current.forEach(marker => {
      mapInstance.removeLayer(marker);
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
        let marker;

        let markerColor: string;
        let markerSize: number;

        if (vehicle.isOnline) {
          if (vehicle.isBusy) {
            // Online but busy - yellow
            markerColor = '#eab308';
            markerSize = 16;
          } else {
            // Online and available - green
            markerColor = '#22c55e';
            markerSize = 16;
          }
        } else {
          // Offline - red
          markerColor = '#ef4444';
          markerSize = 12;
        }

        const iconSize = vehicle.isOnline ? 16 : 12;
        const containerSize = vehicle.isOnline ? 24 : 18;
        marker = L.marker([vehicle.lastLat, vehicle.lastLon], {
          icon: L.divIcon({
            className: vehicle.isOnline ? (vehicle.isBusy ? 'busy-marker' : 'available-marker') : 'offline-marker',
            html: `<div style="background-color: white; border: 2px solid black; border-radius: 6px; padding: 2px;"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${markerColor}" xmlns="http://www.w3.org/2000/svg"><path d="M5 11l1.5-4.5h11L19 11v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8zM6.5 9l-.5 2h11l-.5-2h-10zM7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg></div>`,
            iconSize: [containerSize, containerSize],
            iconAnchor: [containerSize / 2, containerSize / 2]
          })
        });

        // Add popup
        const statusText = vehicle.isBusy ? 'Busy' : 'Available';
        const onlineText = vehicle.isOnline ? 'Online' : 'Offline';
        marker.bindPopup(`
          <strong>${vehicle.make} ${vehicle.model}</strong><br>
          License: ${vehicle.regNumber}<br>
          Status: ${statusText}<br>
          Connection: ${onlineText}<br>
          Type: ${vehicle.vehicleType}
        `);

        marker.addTo(mapInstance);
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
        // Open popup and zoom to vehicle
        marker.openPopup();
        mapInstance.setView([vehicle.lastLat, vehicle.lastLon], 15);
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