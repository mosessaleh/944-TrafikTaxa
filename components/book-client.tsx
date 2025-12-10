"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
// Add Leaflet CSS dynamically
if (typeof window !== 'undefined') {
  const existingLink = document.querySelector('link[href*="leaflet.css"]');
  if (!existingLink) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/leaflet.css';
    document.head.appendChild(link);
  }
}
import AddressAutocomplete, { Suggestion } from '@/components/address-autocomplete';
import dkMessages from '@/messages/dk.json';
import enMessages from '@/messages/en.json';
import { calculateDistance, estimateArrivalTime, formatArrivalTime } from '@/lib/distance';

// Translation messages
const messages = {
  dk: dkMessages,
  en: enMessages
};

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (<div className="grid gap-1"><div className="label">{label}</div>{children}</div>);
}

function formatDKK(n:number){
  try{ return new Intl.NumberFormat('en-DK',{ style:'currency', currency:'DKK', maximumFractionDigits:0 }).format(n); }
  catch{ return `${Math.round(n)} DKK`; }
}

type Vehicle = { id:number; key:string; title:string; capacity:number; multiplier:number };
enum FavApply { Pickup='pickup', Dropoff='dropoff' }
type FavItem = { id:number; label:string; address:string; lat:number|null; lon:number|null };
type Me = { id:number; firstName:string; lastName:string; email?:string; role?:string } | null;

export default function BookClient(){
    const router = useRouter();
    const [language, setLanguage] = useState('dk');

    useEffect(() => {
      const saved = localStorage.getItem('language') || 'dk';
      setLanguage(saved);
    }, []);

    const t = (key: string) => {
      const keys = key.split('.');
      let value: any = messages[language as keyof typeof messages];
      for (const k of keys) {
        value = value?.[k];
      }
      return value || key;
    };

    const { data: profileData, error: profileError } = useSWR('/api/profile', (url) =>
      fetch(url, { credentials: 'include' }).then(r => r.json()).then(j => j?.me ? {
        id: j.me.id,
        firstName: j.me.firstName,
        lastName: j.me.lastName,
        email: j.me.email,
        role: j.me.role
      } : null)
    );
    const me = profileData || null;

  // Booking form state
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupSel, setPickupSel] = useState<Suggestion|null>(null);
  const [dropoffSel, setDropoffSel] = useState<Suggestion|null>(null);
  const [riderName, setRiderName] = useState('');
  const [vehicleId, setVehicleId] = useState<number|null>(null);

  // Clear arrival message when vehicle type changes
  const handleVehicleChange = (newVehicleId: number | null) => {
    setVehicleId(newVehicleId);
    setArrivalMessage(null); // Clear arrival message to force recalculation
    setArrivalLoading(true); // Show loading state immediately

    // Vehicle type selection handled
    const selectedVehicleType = vehicleTypes.find((v: Vehicle) => v.id === newVehicleId);
  };
  const [whenType, setWhenType] = useState<'now'|'later'>('now');
  const [when, setWhen] = useState(() => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000);
    const year = futureTime.getFullYear();
    const month = String(futureTime.getMonth() + 1).padStart(2, '0');
    const day = String(futureTime.getDate()).padStart(2, '0');
    const hours = String(futureTime.getHours()).padStart(2, '0');
    const minutes = String(futureTime.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  // Quote state
  const [quote, setQuote] = useState<{price:number; distanceKm:number; durationMin:number; originalPrice?:number; discountAmount?:number}|null>(null);
  const [qErr, setQErr] = useState<string|null>(null);
  const [qLoading, setQLoading] = useState(false);
  const qTimer = useRef<any>(null);

  // Booking state
  const [bookingLoading, setBookingLoading] = useState(false);
  // Map state
  const [mapInstance, setMapInstance] = useState<any>(null);
  const mapRef = useRef<any>(null);

  // Geolocation state
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);

  // Favorites state
  const [saveModal, setSaveModal] = useState<{open:boolean; target: FavApply|null; name:string; address:string}>({open:false, target:null, name:'', address:''});
  const [pickModal, setPickModal] = useState<{open:boolean; target: FavApply|null}>({open:false, target:null});

  // Vehicle arrival state
  const [arrivalMessage, setArrivalMessage] = useState<string|null>(null);
  const [arrivalLoading, setArrivalLoading] = useState(false);

  // Available vehicles for map display
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);

  useEffect(() => {
    if(me) setRiderName(`${me.firstName} ${me.lastName}`.trim());
  }, [me]);

  // Load available vehicles for map display when pickup location and vehicle type are selected
  useEffect(() => {
    const loadVehicles = async () => {
      if (!pickupSel?.lat || !pickupSel?.lon || !vehicleId) {
        // If no strategy parameters, load all vehicles for basic display
        try {
          const response = await fetch('/api/available-vehicles');
          const data = await response.json();
          if (response.ok && data.ok && data.vehicles) {
            setAvailableVehicles(data.vehicles);
          }
        } catch (error) {
          console.error('Failed to load vehicles for map:', error);
        }
        return;
      }

      // Use strategy with pickup location and vehicle type
      try {
        const params = new URLSearchParams({
          pickupLat: pickupSel.lat.toString(),
          pickupLon: pickupSel.lon.toString(),
          vehicleTypeId: vehicleId.toString()
        });

        const response = await fetch(`/api/available-vehicles?${params}`);
        const data = await response.json();
        if (response.ok && data.ok && data.vehicles) {
          setAvailableVehicles(data.vehicles);
        }
      } catch (error) {
        console.error('Failed to load vehicles with strategy:', error);
        // Fallback to all vehicles
        try {
          const fallbackResponse = await fetch('/api/available-vehicles');
          const fallbackData = await fallbackResponse.json();
          if (fallbackResponse.ok && fallbackData.ok && fallbackData.vehicles) {
            setAvailableVehicles(fallbackData.vehicles);
          }
        } catch (fallbackError) {
          console.error('Fallback vehicle loading also failed:', fallbackError);
        }
      }
    };

    loadVehicles();
  }, [pickupSel?.lat, pickupSel?.lon, vehicleId]);

  const { data: vehicleData } = useSWR('/api/vehicle-types', (url) =>
    fetch(url).then(r => r.json()).then(j => j?.ok ? j.items || [] : [])
  );
  const vehicleTypes = vehicleData || [];
  useEffect(() => {
    if (vehicleTypes.length && vehicleId == null) setVehicleId(vehicleTypes[0].id);
  }, [vehicleTypes, vehicleId]);

  const { data: favoritesData, error: favoritesError, mutate: mutateFavorites } = useSWR(me ? '/api/favorites' : null, (url) =>
    fetch(url, { credentials: 'include' }).then(r => r.status === 200 ? r.json().then(j => j?.ok ? j.favorites || [] : []) : [])
  );
  const favorites = favoritesData || [];


  const bothSelected = !!(pickupSel && dropoffSel);
  const quotePayload = useMemo(() => ({
    pickupAddress: pickupSel?.text || '',
    dropoffAddress: dropoffSel?.text || '',
    pickupLat: pickupSel?.lat ?? null,
    pickupLon: pickupSel?.lon ?? null,
    dropoffLat: dropoffSel?.lat ?? null,
    dropoffLon: dropoffSel?.lon ?? null,
    when: whenType === 'now' ? new Date().toISOString() : new Date(when).toISOString(),
    passengers: 1,
    vehicleTypeId: vehicleId || undefined
  }), [pickupSel, dropoffSel, whenType, when, vehicleId]);

    // Initialize Leaflet and map
    const initializeMap = async () => {
      if (typeof window === 'undefined') return null;
  
      // If we've already created a map instance, reuse it
      if (mapRef.current) {
        const L = (window as any).L;
        return { map: mapRef.current, L };
      }
  
      // Load Leaflet from local file (once)
      if (!(window as any).L) {
        await new Promise((resolve, reject) => {
          // Avoid adding multiple script tags for Leaflet
          const existingScript = document.querySelector('script[src*="leaflet.js"]') as HTMLScriptElement | null;
          if (existingScript) {
            if (existingScript.dataset.loaded === 'true') {
              resolve(null);
              return;
            }
            existingScript.addEventListener('load', () => resolve(null), { once: true });
            existingScript.addEventListener('error', reject, { once: true });
            return;
          }

          const script = document.createElement('script');
          script.src = '/leaflet.js';
          script.async = true;
          script.dataset.loaded = 'false';
          script.onload = () => {
            script.dataset.loaded = 'true';
            resolve(null);
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
  
      const L = (window as any).L;
  
      // After Leaflet is loaded, check again if a map was already created
      if (mapRef.current) {
        return { map: mapRef.current, L };
      }
  
      // Fix default icon paths for Leaflet
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });
  
      const mapDiv = document.getElementById('trip-map');
      if (!mapDiv) return null;
  
      // Create the map only once for this container
      const map = L.map(mapDiv).setView([55.6761, 12.5683], 12); // Default to Copenhagen
      mapRef.current = map;

      // Use OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      // Add click handler for location selection
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;

        // Reverse geocode the clicked location using Nominatim
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            {
              headers: {
                'User-Agent': '944-Taxi-App/1.0'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            let address = data.display_name;

            if (address) {
              // Clean up the address, remove country if it's Denmark
              address = address.replace(/, Denmark$/, '').trim();

              const suggestion: Suggestion = {
                id: null,
                text: address,
                lat: lat,
                lon: lng,
                postcode: data.address?.postcode || null,
                city: data.address?.city || data.address?.town || data.address?.village || null
              };

              // Determine if this should be pickup or dropoff based on current state
              if (!pickupSel) {
                setPickupSel(suggestion);
                setPickup(address);
              } else if (!dropoffSel) {
                setDropoffSel(suggestion);
                setDropoff(address);
              } else {
                // Both are set, ask user or default to pickup
                setPickupSel(suggestion);
                setPickup(address);
              }
            } else {
              alert('Unable to determine address for this location. Please enter address manually.');
            }
          } else {
            alert('Unable to determine address for this location. Please enter address manually.');
          }
        } catch (error) {
          console.warn('Reverse geocoding failed for map click:', error);
          alert('Unable to determine address for this location. Please enter address manually.');
        }
      });
  
      return { map, L };
    };
 
  // Initialize base map once so the map container is always populated
  useEffect(() => {
    let cancelled = false;
 
    const setup = async () => {
      if (mapInstance) return;
      const initialized = await initializeMap();
      if (!cancelled && initialized) {
        setMapInstance(initialized);
      }
    };
 
    setup();
 
    return () => {
      cancelled = true;
    };
  }, [mapInstance]);
 
  // Update map with any available markers and detailed route when both addresses are selected
  const updateMapWithLocations = async () => {
    try {
      // Ensure we always have a usable map instance in this call
      let instance = mapInstance;
      if (!instance) {
        const initialized = await initializeMap();
        if (!initialized) return;
        instance = initialized;
        setMapInstance(initialized);
      }
 
      const { map, L } = instance;
 
      const hasPickup = !!(pickupSel && pickupSel.lat && pickupSel.lon);
      const hasDropoff = !!(dropoffSel && dropoffSel.lat && dropoffSel.lon);
 
      // Clear existing markers and polylines (keep base tile layer)
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
          map.removeLayer(layer);
        }
      });
 
      const markers: any[] = [];

      // Add current location marker (blue) if available
      if (currentLocation) {
        const currentLocationMarker = L.marker([currentLocation.lat, currentLocation.lng], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: relative;"><div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map);
        currentLocationMarker.bindPopup(`<strong>Your Location</strong><br><em>Click map to select pickup/dropoff</em>`);
        markers.push(currentLocationMarker);
      }

      // Add pickup marker (green) if available
      if (hasPickup && pickupSel) {
        const pickupMarker = L.marker([pickupSel.lat, pickupSel.lon], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map);
        pickupMarker.bindPopup(`<strong>Pickup:</strong><br>${pickupSel.text}`);
        markers.push(pickupMarker);
      }
 
      // Add dropoff marker (red) if available
      if (hasDropoff && dropoffSel) {
        const dropoffMarker = L.marker([dropoffSel.lat, dropoffSel.lon], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map);
        dropoffMarker.bindPopup(`<strong>Destination:</strong><br>${dropoffSel.text}`);
        markers.push(dropoffMarker);
      }

      // Add available vehicle markers (black cars)
      if (availableVehicles.length > 0) {
        availableVehicles.forEach(vehicle => {
          if (vehicle.lastLat && vehicle.lastLon) {
            const vehicleColor = vehicle.isBusy ? '#eab308' : '#22c55e'; // Yellow for busy, green for available
            const vehicleMarker = L.marker([vehicle.lastLat, vehicle.lastLon], {
              icon: L.divIcon({
                className: 'vehicle-marker',
                html: `<div style="background-color: white; border: 2px solid black; border-radius: 6px; padding: 2px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="${vehicleColor}" xmlns="http://www.w3.org/2000/svg"><path d="M5 11l1.5-4.5h11L19 11v8a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8zM6.5 9l-.5 2h11l-.5-2h-10zM7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(map);
            const statusText = vehicle.isBusy ? 'Busy' : 'Available';
            vehicleMarker.bindPopup(`<strong>${vehicle.make} ${vehicle.model}</strong><br>License: ${vehicle.regNumber}<br>Status: ${statusText}`);
          }
        });
      }
 
      // Adjust map view based on available markers
      if (markers.length === 1) {
        map.setView(markers[0].getLatLng(), 14);
      } else if (markers.length === 2) {
        const group = new L.FeatureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
      } else if (!hasPickup && !hasDropoff) {
        // No locations selected, reset to default view
        map.setView([55.6761, 12.5683], 12);
      }
 
      // If both pickup and dropoff are available, draw route between them
      if (hasPickup && hasDropoff && pickupSel && dropoffSel) {
        // Default route = straight line (fallback)
        let routeLatLngs: [number, number][] = [
          [pickupSel.lat as number, pickupSel.lon as number],
          [dropoffSel.lat as number, dropoffSel.lon as number]
        ];
 
        // Try to fetch detailed route geometry from our routing API
        try {
          const resp = await fetch(
            `/api/route?startLat=${pickupSel.lat}&startLon=${pickupSel.lon}&endLat=${dropoffSel.lat}&endLon=${dropoffSel.lon}`,
            { cache: 'no-store' }
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data.ok && data.route?.geometry?.coordinates?.length) {
              // OpenRouteService returns [lon, lat], Leaflet expects [lat, lon]
              routeLatLngs = data.route.geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]] as [number, number]
              );
            }
          }
        } catch (routeErr) {
          console.warn('Route API failed, falling back to straight line:', routeErr);
        }
 
        // Draw route polyline (detailed if API succeeded, straight if not)
        L.polyline(routeLatLngs, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
          dashArray: '10, 5'
        }).addTo(map);
      }
    } catch (error) {
      console.error('Error updating map:', error);
    }
  };
 
  // Update map when locations are selected or vehicles are loaded
  useEffect(() => {
    updateMapWithLocations();
  }, [pickupSel, dropoffSel, availableVehicles]);

  // Check location permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state as 'granted' | 'denied' | 'prompt');
        result.addEventListener('change', () => {
          setLocationPermission(result.state as 'granted' | 'denied' | 'prompt');
        });
      }).catch(() => {
        // Permissions API not supported, fallback to trying geolocation
        setLocationPermission('prompt');
      });
    }
  }, []);

  // Get current location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;
      const location = { lat: latitude, lng: longitude };

      setCurrentLocation(location);
      setLocationPermission('granted');

      // Reverse geocode to get address using Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          {
            headers: {
              'User-Agent': '944-Taxi-App/1.0'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          let address = data.display_name;

          if (address) {
            // Clean up the address, remove country if it's Denmark
            address = address.replace(/, Denmark$/, '').trim();

            // Set as pickup location
            const suggestion: Suggestion = {
              id: null,
              text: address,
              lat: latitude,
              lon: longitude,
              postcode: data.address?.postcode || null,
              city: data.address?.city || data.address?.town || data.address?.village || null
            };

            setPickupSel(suggestion);
            setPickup(address);
          } else {
            alert('Unable to determine address for your location. Please enter address manually.');
          }
        } else {
          alert('Unable to determine address for your location. Please enter address manually.');
        }
      } catch (geocodeError) {
        console.warn('Reverse geocoding failed:', geocodeError);
        alert('Unable to determine address for your location. Please enter address manually.');
      }

    } catch (error: any) {
      console.error('Geolocation error:', error);

      let errorMessage = 'Unable to get your location';

      if (error.code === 1) {
        errorMessage = 'Location access denied. Please enable location permissions.';
        setLocationPermission('denied');
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS settings.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again.';
      }

      setLocationError(errorMessage);
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if(qTimer.current) clearTimeout(qTimer.current);
    const ready = bothSelected && !!vehicleId;
    if(!ready){ setQuote(null); setQErr(null); return; }

    qTimer.current = setTimeout(async() => {
      try{
        setQLoading(true);
        setQErr(null);
        const r = await fetch('/api/quote', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(quotePayload)
        });
        const j = await r.json();
        if(!r.ok || !j?.ok) throw new Error(j?.error||'Failed to get quote');
        setQuote({
          price: j.price,
          distanceKm: j.distanceKm,
          durationMin: j.durationMin,
          originalPrice: j.originalPrice,
          discountAmount: j.discountAmount
        });
      }catch(e:any){
        setQuote(null);
        setQErr(e?.message||'Failed to get quote');
      } finally{
        setQLoading(false);
      }
    }, 200);
    return () => { if(qTimer.current) clearTimeout(qTimer.current); };
  }, [bothSelected, quotePayload, vehicleId]);

  // Calculate nearest vehicle arrival time when pickup is selected
  useEffect(() => {
    if (!pickupSel || !pickupSel.lat || !pickupSel.lon) {
      setArrivalMessage(null);
      return;
    }

    const calculateArrival = async () => {
      try {
        setArrivalLoading(true);
        setArrivalMessage(null);

        // Use strategy parameters if available
        let apiUrl = '/api/available-vehicles';
        if (pickupSel?.lat && pickupSel?.lon && vehicleId) {
          const params = new URLSearchParams({
            pickupLat: pickupSel.lat.toString(),
            pickupLon: pickupSel.lon.toString(),
            vehicleTypeId: vehicleId.toString()
          });
          apiUrl = `/api/available-vehicles?${params}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok || !data.ok || !data.vehicles?.length) {
          setArrivalMessage(null);
          setAvailableVehicles([]);
          return;
        }

        const vehicles = data.vehicles as any[];
        setAvailableVehicles(vehicles);

        // Get selected vehicle type for smart filtering
        const selectedVehicleType = vehicleTypes?.find((v: Vehicle) => v.id === vehicleId);
        const selectedVehicleKey = selectedVehicleType?.key;

        // Separate available and busy vehicles
        const availableVehicles = vehicles.filter((v: any) => !v.isBusy);
        const busyVehicles = vehicles.filter((v: any) => v.isBusy);

        let closestVehicle = null;
        let minTotalTime = Infinity;

        // Smart vehicle selection with priority rules
        const getVehiclesByPriority = (vehicleList: any[], isBusy: boolean = false) => {
          if (!selectedVehicleKey) return { vehicles: vehicleList, compatibleTypes: [], exactType: [] };

          let exactType: string[] = [];
          let compatibleTypes: string[] = [];

          switch (selectedVehicleKey) {
            case 'SEDAN5': // سيارة عادية (Regular Car)
              exactType = ['SEDAN5', '1'];
              compatibleTypes = ['SEVEN_NO_BAG', '2', 'VAN', '3'];
              break;
            case 'SEVEN_NO_BAG': // سيارة 7 ركاب (7-seater car)
              exactType = ['SEVEN_NO_BAG', '2'];
              compatibleTypes = ['VAN', '3'];
              break;
            case 'VAN': // فان (Van)
              exactType = ['VAN', '3'];
              compatibleTypes = []; // No compatible types
              break;
            case 'LIMO': // ليموزين (Limousine)
              exactType = ['LIMO', '4'];
              compatibleTypes = []; // Only limousines can take limo rides
              break;
            default:
              return { vehicles: vehicleList, compatibleTypes: [], exactType: [] };
          }

          // First, check if any exact type vehicles are within 15 minutes
          const exactVehicles = vehicleList.filter((v: any) =>
            exactType.includes(v.vehicleType)
          );

          const exactWithin15 = exactVehicles.filter((v: any) => {
            if (v.lastLat && v.lastLon && pickupSel.lat && pickupSel.lon) {
              const distance = calculateDistance(
                pickupSel.lat,
                pickupSel.lon,
                v.lastLat,
                v.lastLon
              );
              const arrivalMinutes = isBusy ? estimateArrivalTime(distance) + (v.estimatedExtraTime || 0) : estimateArrivalTime(distance);
              return arrivalMinutes <= 15;
            }
            return false;
          });

          let filteredVehicles;
          if (exactWithin15.length > 0) {
            // Use only exact type vehicles within 15 min
            filteredVehicles = exactWithin15;
          } else {
            // Use exact type + compatible types
            filteredVehicles = vehicleList.filter((v: any) =>
              exactType.includes(v.vehicleType) || compatibleTypes.includes(v.vehicleType)
            );
          }

          return { vehicles: filteredVehicles, compatibleTypes, exactType };
        };

        const { vehicles: filteredAvailableVehicles, compatibleTypes: availableCompatibleTypes, exactType: availableExactType } = getVehiclesByPriority(availableVehicles);
        const { vehicles: filteredBusyVehicles, compatibleTypes: busyCompatibleTypes, exactType: busyExactType } = getVehiclesByPriority(busyVehicles, true);

        // Find top 3 closest vehicles using real routing
        const findClosestVehicles = async (vehicleList: any[], isBusy: boolean = false, limit: number = 3) => {
          const vehiclesWithTimes: { vehicle: any; time: number }[] = [];

          for (const vehicle of vehicleList) {
            if (vehicle.lastLat && vehicle.lastLon && pickupSel.lat && pickupSel.lon) {
              try {
                // Call route API for real driving time
                const routeResponse = await fetch(`/api/route?startLat=${vehicle.lastLat}&startLon=${vehicle.lastLon}&endLat=${pickupSel.lat}&endLon=${pickupSel.lon}`);
                if (routeResponse.ok) {
                  const routeData = await routeResponse.json();
                  if (routeData.ok && routeData.route?.duration) {
                    const durationMinutes = Math.ceil(routeData.route.duration / 60); // Convert seconds to minutes
                    const totalTime = isBusy ? durationMinutes + (vehicle.estimatedExtraTime || 0) : durationMinutes;
                    vehiclesWithTimes.push({ vehicle, time: totalTime });
                  } else {
                    // Fallback to simple calculation
                    const distance = calculateDistance(
                      pickupSel.lat,
                      pickupSel.lon,
                      vehicle.lastLat,
                      vehicle.lastLon
                    );
                    const arrivalMinutes = estimateArrivalTime(distance);
                    const totalTime = isBusy ? arrivalMinutes + (vehicle.estimatedExtraTime || 0) : arrivalMinutes;
                    vehiclesWithTimes.push({ vehicle, time: totalTime });
                  }
                } else {
                  // Fallback
                  const distance = calculateDistance(
                    pickupSel.lat,
                    pickupSel.lon,
                    vehicle.lastLat,
                    vehicle.lastLon
                  );
                  const arrivalMinutes = estimateArrivalTime(distance);
                  const totalTime = isBusy ? arrivalMinutes + (vehicle.estimatedExtraTime || 0) : arrivalMinutes;
                  vehiclesWithTimes.push({ vehicle, time: totalTime });
                }
              } catch (error) {
                // Fallback
                const distance = calculateDistance(
                  pickupSel.lat,
                  pickupSel.lon,
                  vehicle.lastLat,
                  vehicle.lastLon
                );
                const arrivalMinutes = estimateArrivalTime(distance);
                const totalTime = isBusy ? arrivalMinutes + (vehicle.estimatedExtraTime || 0) : arrivalMinutes;
                vehiclesWithTimes.push({ vehicle, time: totalTime });
              }
            }
          }

          // Sort by time and take top limit
          vehiclesWithTimes.sort((a, b) => a.time - b.time);
          return vehiclesWithTimes.slice(0, limit);
        };

        // Find top 3 closest available vehicles
        let availableResults = await findClosestVehicles(filteredAvailableVehicles);

        // If less than 3 vehicles after priority filtering, fill with closest from remaining compatible vehicles (using dropoff location if available)
        if (availableResults.length < 3) {
          const remainingVehicles = availableVehicles.filter(v => !filteredAvailableVehicles.some(fv => fv.id === v.id) && (availableCompatibleTypes.includes(v.vehicleType) || availableExactType.includes(v.vehicleType)));
          const fillResults: { vehicle: any; time: number }[] = [];
          const targetLat = dropoffSel?.lat || pickupSel.lat;
          const targetLon = dropoffSel?.lon || pickupSel.lon;

          for (const vehicle of remainingVehicles) {
            if (vehicle.lastLat && vehicle.lastLon && targetLat && targetLon) {
              try {
                const routeResponse = await fetch(`/api/route?startLat=${vehicle.lastLat}&startLon=${vehicle.lastLon}&endLat=${targetLat}&endLon=${targetLon}`);
                if (routeResponse.ok) {
                  const routeData = await routeResponse.json();
                  if (routeData.ok && routeData.route?.duration) {
                    const durationMinutes = Math.ceil(routeData.route.duration / 60);
                    const totalTime = durationMinutes; // not busy
                    fillResults.push({ vehicle, time: totalTime });
                  } else {
                    const distance = calculateDistance(targetLat, targetLon, vehicle.lastLat, vehicle.lastLon);
                    const arrivalMinutes = estimateArrivalTime(distance);
                    const totalTime = arrivalMinutes;
                    fillResults.push({ vehicle, time: totalTime });
                  }
                } else {
                  const distance = calculateDistance(targetLat, targetLon, vehicle.lastLat, vehicle.lastLon);
                  const arrivalMinutes = estimateArrivalTime(distance);
                  const totalTime = arrivalMinutes;
                  fillResults.push({ vehicle, time: totalTime });
                }
              } catch (error) {
                const distance = calculateDistance(targetLat, targetLon, vehicle.lastLat, vehicle.lastLon);
                const arrivalMinutes = estimateArrivalTime(distance);
                const totalTime = arrivalMinutes;
                fillResults.push({ vehicle, time: totalTime });
              }
            }
          }

          // Sort fillResults by time and take needed amount
          fillResults.sort((a, b) => a.time - b.time);
          const needed = 3 - availableResults.length;
          availableResults.push(...fillResults.slice(0, needed));
          // Sort again by time to prioritize filtered vehicles
          availableResults.sort((a, b) => a.time - b.time);
          // Take top 3
          availableResults.splice(3);
        }

        console.log('Top 3 closest available vehicles:', availableResults.map(r => ({ id: r.vehicle.id, time: r.time })));
        if (availableResults.length > 0) {
          closestVehicle = availableResults[0].vehicle;
          minTotalTime = availableResults[0].time;
        } else if (filteredBusyVehicles.length > 0) {
          // Check busy vehicles if no available
          const busyResults = await findClosestVehicles(filteredBusyVehicles, true);
          console.log('Top 3 closest busy vehicles:', busyResults.map(r => ({ id: r.vehicle.id, time: r.time })));
          if (busyResults.length > 0) {
            closestVehicle = busyResults[0].vehicle;
            minTotalTime = busyResults[0].time;
          }
        }

        if (closestVehicle && minTotalTime < Infinity) {
            // Only show arrival time if total time is within 45 minutes (including busy vehicle time)
            if (minTotalTime <= 45) {
              const timeText = formatArrivalTime(minTotalTime);
              const busyText = closestVehicle.isBusy ? " (currently busy, will finish current ride first)" : "";
              setArrivalMessage(`The closest car to you arrives in ${timeText}${busyText}`);
            } else {
              setArrivalMessage("No cars available currently");
            }
          } else {
            setArrivalMessage("No cars available currently");
          }
      } catch (error) {
        console.error('Failed to calculate vehicle arrival:', error);
        setArrivalMessage(null);
      } finally {
        setArrivalLoading(false);
      }
    };

    calculateArrival();
  }, [pickupSel, vehicleId]);

  async function handleBookAndConfirm(){
    if(!quote || !me) return;

    // Temporarily disable scheduled bookings
    if (whenType === 'later') {
      alert(t('book.scheduled_bookings_disabled') || 'Scheduled bookings are temporarily unavailable. Only instant bookings are currently supported.');
      return;
    }

    setBookingLoading(true);
    try{
      const bookingData = {
        riderName,
        passengers: 1,
        pickupAddress: quotePayload.pickupAddress,
        dropoffAddress: quotePayload.dropoffAddress,
        pickupLat: quotePayload.pickupLat,
        pickupLon: quotePayload.pickupLon,
        dropoffLat: quotePayload.dropoffLat,
        dropoffLon: quotePayload.dropoffLon,
        vehicleTypeId: vehicleId!,
        scheduled: false, // Always instant booking for now
        pickupTime: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
        // paymentMethod will be selected on payment page
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      // Redirect to payment method selection page
      router.push(`/pay?booking_id=${data.ride.id}&amount_dkk=${data.ride.price}`);

    }catch(e:any){
      console.error("BookClient: Booking failed", e);
      alert(e?.message||'Failed to create booking');
    } finally {
      setBookingLoading(false);
    }
  }

  // Favorites functions
  async function saveFavorite(){
    try{
      if(!saveModal.target) return;
      const addr = saveModal.address?.trim();
      if(!addr) return;
      const r = await fetch('/api/favorites',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({
          label: saveModal.name||'Favorite',
          address: addr,
          lat: (saveModal.target===FavApply.Pickup? pickupSel?.lat: dropoffSel?.lat)??null,
          lon: (saveModal.target===FavApply.Pickup? pickupSel?.lon: dropoffSel?.lon)??null
        })
      });
      const j = await r.json();
      if(j?.ok){
        mutateFavorites();
        setSaveModal({open:false,target:null,name:'',address:''});
        alert('Address saved to favorites successfully!');
      } else {
        alert('Failed to save favorite: ' + (j?.error || 'Unknown error'));
      }
    }catch(e){
      console.error('Save favorite error:', e);
      alert('Failed to save favorite. Please try again.');
    }
  }

  function applyFav(f:FavItem, to:FavApply){
    const s: Suggestion = { id: null, text: f.address, lat: f.lat, lon: f.lon, postcode:null, city:null };
    if(to===FavApply.Pickup){
      setPickupSel(s);
      setPickup(s.text);
    } else {
      setDropoffSel(s);
      setDropoff(s.text);
    }
    setPickModal({ open:false, target:null });
  }

  const Star = ({onClick}:{onClick:()=>void}) => (
    <button type="button" onClick={onClick} title="Save to favorites" aria-label="Save to favorites" className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border bg-white hover:bg-gray-50 active:scale-[.98] transition">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M11.48 3.499a.75.75 0 0 1 1.04 0l2.644 2.58 3.532.514a.75.75 0 0 1 .416 1.279l-2.556 2.49.604 3.52a.75.75 0 0 1-1.088.79L12 13.97l-3.172 1.673a.75.75 0 0 1-1.088-.79l.604-3.52-2.556-2.49a.75.75 0 0 1 .416-1.279l3.532-.514 2.644-2.58Z"/>
      </svg>
    </button>
  );

  const currentVehicle = vehicleTypes.find((v: Vehicle) => v.id === vehicleId);
  const vehicleEmoji =
    currentVehicle && currentVehicle.capacity >= 6
      ? "🚐"
      : "🚕";
 
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8 lg:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              {t('book.title')}
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-600">
              {t('book.subtitle')}
            </p>
          </div>
          {quote && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                  {t('book.current_estimate')}
                </div>
                <div className="flex items-center gap-2">
                  {quote.discountAmount && quote.discountAmount > 0 ? (
                    <>
                      <span className="text-sm text-slate-500 line-through">
                        {formatDKK(quote.originalPrice || quote.price)}
                      </span>
                      <span className="text-lg md:text-xl font-bold text-green-600">
                        {formatDKK(quote.price)}
                      </span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        -{formatDKK(quote.discountAmount)}
                      </span>
                    </>
                  ) : (
                    <span className="text-lg md:text-xl font-bold text-slate-900">
                      {formatDKK(quote.price)}
                    </span>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex flex-col text-xs text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span>📍</span>
                  ~{quote.distanceKm?.toFixed?.(2)} km
                </span>
                <span className="inline-flex items-center gap-1">
                  <span>⏱️</span>
                  ~{quote.durationMin} min
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Auth banners */}
        <div className="space-y-3 mb-6">
          {/* Booking policy notification */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
            <div className="text-2xl leading-none">ℹ️</div>
            <div>
              <h3 className="text-sm font-semibold text-blue-800">{t('book.booking_info')}</h3>
              <ul className="text-xs sm:text-sm text-blue-700 mt-1 space-y-1">
                {t('book.booking_info_items').map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>

          {!me && !profileError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <div className="text-2xl leading-none">🔐</div>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">{t('book.login_required')}</h3>
                <p className="text-xs sm:text-sm text-amber-700 mt-1">
                  {t('book.login_required_desc')}
                </p>
              </div>
            </div>
          )}

          {profileError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-3">
              <div className="text-2xl leading-none">⚠️</div>
              <div>
                <h3 className="text-sm font-semibold text-rose-800">{t('book.auth_error')}</h3>
                <p className="text-xs sm:text-sm text-rose-700 mt-1">
                  {t('book.auth_error_desc')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Main layout */}
        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
          {/* Booking form card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="px-4 sm:px-6 py-5 sm:py-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <span className="text-cyan-600 text-xl">📍</span>
                  {t('book.trip_details')}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t('book.trip_details_desc')}
                </p>
              </div>

              <div className="grid gap-5 md:gap-6">
                {/* Pickup Address */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="text-green-600">🚀</span>
                      {t('book.pickup_address')}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                        className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors text-blue-600 hover:text-blue-700 hover:bg-blue-50 ${locationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Use my current location"
                      >
                        {locationLoading ? (
                          <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                        ) : (
                          <span>📍</span>
                        )}
                        {t('book.use_my_location')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickModal({ open: true, target: FavApply.Pickup })}
                        className="text-xs text-cyan-600 hover:text-cyan-700 font-medium inline-flex items-center gap-1"
                      >
                        <span>⭐</span>
                        {t('book.favorites')}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <AddressAutocomplete
                        label=""
                        name="pickup"
                        value={pickup}
                        onChange={v => {
                          setPickup(v);
                          setPickupSel(null);
                        }}
                        onSelect={s => {
                          setPickupSel(s);
                          setPickup(s.text);
                        }}
                      />
                    </div>
                    {pickupSel && (
                      <Star
                        onClick={() =>
                          setSaveModal({
                            open: true,
                            target: FavApply.Pickup,
                            name: '',
                            address: pickupSel?.text || ''
                          })
                        }
                      />
                    )}
                  </div>
                  {arrivalLoading && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                      Finding nearest vehicle...
                    </div>
                  )}
                  {arrivalMessage && !arrivalLoading && (
                    <div className={`text-xs px-3 py-2 rounded-lg border ${
                      arrivalMessage.includes("No cars available")
                        ? "text-orange-600 bg-orange-50 border-orange-200"
                        : "text-green-600 bg-green-50 border-green-200"
                    }`}>
                      {arrivalMessage.includes("No cars available") ? "⚠️" : "🚗"} {arrivalMessage}
                    </div>
                  )}
                  {locationError && (
                    <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                      ⚠️ {locationError}
                    </div>
                  )}
                </div>

                {/* Dropoff Address */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <span className="text-red-600">🎯</span>
                      {t('book.dropoff_address')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickModal({ open: true, target: FavApply.Dropoff })}
                      className="text-xs text-cyan-600 hover:text-cyan-700 font-medium inline-flex items-center gap-1"
                    >
                      <span>⭐</span>
                      {t('book.favorites')}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <AddressAutocomplete
                        label=""
                        name="dropoff"
                        value={dropoff}
                        onChange={v => {
                          setDropoff(v);
                          setDropoffSel(null);
                        }}
                        onSelect={s => {
                          setDropoffSel(s);
                          setDropoff(s.text);
                        }}
                      />
                    </div>
                    {dropoffSel && (
                      <Star
                        onClick={() =>
                          setSaveModal({
                            open: true,
                            target: FavApply.Dropoff,
                            name: '',
                            address: dropoffSel?.text || ''
                          })
                        }
                      />
                    )}
                  </div>
                </div>

                {/* Vehicle & passenger */}
                <div className="grid gap-4 md:gap-6">
                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <span className="text-purple-600">🚙</span>
                        {t('book.vehicle_type')}
                      </label>
                      <select
                        value={vehicleId ?? ''}
                        onChange={e => handleVehicleChange(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-150 hover:shadow-md text-sm"
                      >
                        {vehicleTypes.map((v: Vehicle) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <span className="text-blue-600">👤</span>
                        {t('book.passenger_name')}
                      </label>
                      <input
                        value={riderName}
                        onChange={e => setRiderName(e.target.value)}
                        placeholder={t('book.passenger_placeholder')}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-150 hover:shadow-md text-sm"
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <span className="text-indigo-600">🕐</span>
                        {t('book.schedule_pickup')}
                      </label>
                      <select
                        value={whenType}
                        onChange={e => setWhenType(e.target.value as 'now' | 'later')}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-150 hover:shadow-md text-sm"
                      >
                        <option value="now">🕐 {language === 'dk' ? 'Nu' : 'Now'}</option>
                        <option value="later">📅 {t('book.schedule_later')}</option>
                      </select>
                    </div>
                    {whenType === 'later' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <span className="text-emerald-600">📆</span>
                          {t('book.pickup_datetime')}
                        </label>
                        <input
                          type="datetime-local"
                          value={when}
                          min={(() => {
                            const futureTime = new Date(Date.now() + 60 * 60 * 1000);
                            const year = futureTime.getFullYear();
                            const month = String(futureTime.getMonth() + 1).padStart(2, '0');
                            const day = String(futureTime.getDate()).padStart(2, '0');
                            const hours = String(futureTime.getHours()).padStart(2, '0');
                            const minutes = String(futureTime.getMinutes()).padStart(2, '0');
                            return `${year}-${month}-${day}T${hours}:${minutes}`;
                          })()}
                          onChange={e => {
                            const selectedTime = new Date(e.target.value);
                            const minTime = new Date(Date.now() + 60 * 60 * 1000);
                            if (selectedTime >= minTime) {
                              setWhen(e.target.value);
                            } else {
                              // Reset to minimum time if invalid selection
                              const year = minTime.getFullYear();
                              const month = String(minTime.getMonth() + 1).padStart(2, '0');
                              const day = String(minTime.getDate()).padStart(2, '0');
                              const hours = String(minTime.getHours()).padStart(2, '0');
                              const minutes = String(minTime.getMinutes()).padStart(2, '0');
                              setWhen(`${year}-${month}-${day}T${hours}:${minutes}`);
                            }
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-all duration-150 hover:shadow-md text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>


                {/* CTA */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex flex-col gap-3">
                    <div className="text-xs sm:text-sm text-slate-600">
                      {!me && !profileError && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <span>⚠️</span>
                          {t('book.login_required_booking')}
                        </span>
                      )}
                      {profileError && (
                        <span className="flex items-center gap-1 text-red-600">
                          <span>❌</span>
                          {t('book.session_problem')}
                        </span>
                      )}
                      {me && quote && whenType === 'later' && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <span>⏰</span>
                          {t('book.scheduled_bookings_disabled')}
                        </span>
                      )}
                      {me && quote && whenType === 'now' && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <span>✅</span>
                          {t('book.ready_to_book')}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleBookAndConfirm}
                      disabled={
                        !me ||
                        profileError ||
                        !quote ||
                        qLoading ||
                        !bothSelected ||
                        !vehicleId ||
                        bookingLoading ||
                        whenType === 'later'
                      }
                      className={`w-full px-5 py-3.5 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-150 flex items-center justify-center gap-2 min-h-[48px] ${
                        !me ||
                        profileError ||
                        !quote ||
                        qLoading ||
                        !bothSelected ||
                        !vehicleId ||
                        bookingLoading
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 text-white shadow-md hover:shadow-lg hover:bg-black'
                      }`}
                    >
                      {bookingLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                          {t('book.creating_booking')}
                        </>
                      ) : (
                        <>
                          <span>✅</span>
                          {t('book.confirm_booking')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price & map card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm lg:sticky lg:top-24">
            <div className="px-4 sm:px-6 py-5 sm:py-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    {t('book.estimated_price')}
                  </div>
                  <div className="mt-2">
                    {quote && quote.discountAmount && quote.discountAmount > 0 ? (
                      <div className="flex flex-col gap-1">
                        <div className="text-slate-500 line-through text-lg">
                          {formatDKK(quote.originalPrice || quote.price)}
                        </div>
                        <div className="text-3xl md:text-4xl font-extrabold text-green-600">
                          {formatDKK(quote.price)}
                        </div>
                        <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full inline-block w-fit">
                          Save {formatDKK(quote.discountAmount)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-3xl md:text-4xl font-extrabold text-slate-900">
                        {quote ? formatDKK(quote.price) : formatDKK(0)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white shadow-md">
                  <span className="text-xl">{vehicleEmoji}</span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-600">
                {quote ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      <span>📍</span>
                      ~{quote.distanceKm?.toFixed?.(2)} km
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      <span>⏱️</span>
                      ~{quote.durationMin} min
                    </span>
                  </div>
                ) : (
                  <p className="text-slate-500">
                    {t('book.select_addresses')}
                  </p>
                )}
              </div>

              {/* Map */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-slate-600">
                    🗺️ {t('book.map_click')}
                  </div>
                  {currentLocation && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      📍 {t('book.location_shown')}
                    </div>
                  )}
                </div>
                <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                  <div id="trip-map" className="h-full w-full"></div>
                  {!pickupSel && !dropoffSel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5 pointer-events-none">
                      <div className="bg-white/90 px-4 py-2 rounded-lg shadow-sm text-sm text-slate-600">
                        {t('book.click_map_pickup')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {qLoading && (
                <div className="flex items-center justify-center gap-2 mt-3 text-cyan-700 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-600 border-t-transparent"></div>
                  {t('book.calculating_price')}
                </div>
              )}

              {qErr && (
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm">
                  ⚠️ {qErr}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Favorite Modal */}
      {saveModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div
            className="w-full max-w-md rounded-2xl border bg-white p-4 md:p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{t('book.save_favorite')}</h3>
              <Field label={t('book.favorite_label_placeholder')}>
                <input
                  value={saveModal.name}
                  onChange={e => setSaveModal(s => ({ ...s, name: e.target.value }))}
                  placeholder={t('book.favorite_label_placeholder')}
                  className="input"
                />
              </Field>
              <Field label={t('book.address')}>
                <input
                  value={saveModal.address}
                  onChange={e => setSaveModal(s => ({ ...s, address: e.target.value }))}
                  className="input"
                />
              </Field>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setSaveModal({ open: false, target: null, name: '', address: '' })}
                  className="btn-ghost"
                >
                  {t('book.cancel')}
                </button>
                <button onClick={saveFavorite} className="btn-primary">
                  {t('book.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pick Favorite Modal */}
      {pickModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div
            className="w-full max-w-md rounded-2xl border bg-white p-4 md:p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{t('book.choose_favorite')}</h3>
              <div className="max-h-80 overflow-y-auto">
                {favorites.length === 0 && (
                  <div className="text-sm text-gray-600">
                    {t('book.no_favorites')}
                  </div>
                )}
                {favorites.length > 0 && (
                  <ul className="divide-y">
                    {favorites.map((f: FavItem) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => applyFav(f, pickModal.target as FavApply)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="font-medium text-sm">{f.label}</div>
                          <div className="text-xs text-gray-600">{f.address}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setPickModal({ open: false, target: null })}
                  className="btn-ghost"
                >
                  {t('book.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
