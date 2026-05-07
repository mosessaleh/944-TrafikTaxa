"use client";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import io, { Socket } from 'socket.io-client';

// Types
interface User {
  id: string;
  role?: string;
  type?: string;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

interface Driver {
  id: string;
  drFname: string;
  drLname: string;
  lastLocation?: DriverLocation;
  car?: string; // Vehicle registration number
  profileImage?: string;
}

interface Booking {
  id: string;
  userId: string;
  driverId?: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  stopAddress?: string | null;
  pickupTime: string;
  price: number;
  startLatLon?: [number, number] | { lat: number; lng: number };
  stopLatLon?: [number, number] | { lat: number; lng: number };
  driver?: Driver;
}

interface ChatMessage {
  message: string;
  sender: 'passenger' | 'driver';
  timestamp: string;
}

interface BookingUpdateData {
  bookingId: string;
  status: string;
}

function WaitingForDriverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const forceAccess = searchParams.get("force") === "true";

  const [bookingDetails, setBookingDetails] = useState<Booking | null>(null);
  const [countdown, setCountdown] = useState(180);
  const [autoCancelCountdown, setAutoCancelCountdown] = useState(600); // 10 minutes
  const [canCancel, setCanCancel] = useState(false);
  const [searchingStatus, setSearchingStatus] = useState<string>("Searching for a driver...");
  const [driverFound, setDriverFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const passengerMarkerRef = useRef<any>(null);
  const routeRendererRef = useRef<any>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const autoCancelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  // Initialize Google Maps
  const initializeMap = useCallback(async () => {
    if (typeof window === 'undefined' || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('waiting-for-driver: Google Maps API key not found');
      return;
    }

    try {
      // Check if Google Maps is already loaded
      if (!(window as any).google) {
        // Load Google Maps API
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=da`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        // Wait for Google Maps to load
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Maps'));
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error('Google Maps load timeout')), 10000);
        });
      }

      const google = (window as any).google;
      if (!google || !google.maps) {
        throw new Error('Google Maps not available');
      }

      const mapContainer = document.getElementById('waiting-map');
      if (!mapContainer) return;

      const map = new google.maps.Map(mapContainer, {
        center: { lat: 56.2639, lng: 9.5018 },
        zoom: 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
      mapRef.current = map;
    } catch (err) {
      console.error('waiting-for-driver: failed to initialize map', err);
      setMapError(true);
      // Don't throw error, just log it - map is optional
    }
  }, []);

  // Play sound when driver is found
  useEffect(() => {
    if (driverFound) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            playSound(audioContext);
          }).catch(err => console.warn('waiting-for-driver: could not resume audio context', err));
        } else {
          playSound(audioContext);
        }
      } catch (err) {
        console.warn('waiting-for-driver: could not play notification sound', err);
      }
    }
  }, [driverFound]);

  const playSound = (audioContext: AudioContext) => {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn('waiting-for-driver: could not play sound', err);
    }
  };

  // Initialize chat when driver is found
  useEffect(() => {
    if (driverFound && bookingId && socketRef.current) {
      socketRef.current.emit('joinChat', { bookingId });

      socketRef.current.on('newMessage', (data: ChatMessage) => {
        setChatMessages(prev => [...prev, data]);
      });
    }
  }, [driverFound, bookingId]);

  // Initialize map when driver is found
  useEffect(() => {
    if (driverFound && bookingDetails) {
      initializeMap().then(() => {
        updateMap(bookingDetails);
      }).catch(err => {
        console.error('waiting-for-driver: map initialization failed', err);
        setMapError(true);
      });
    }
  }, [driverFound, bookingDetails]);

  // Periodic refresh of booking data
  useEffect(() => {
    const refreshInterval = setInterval(refreshBookingData, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [bookingId, driverFound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
      if (autoCancelIntervalRef.current) {
        clearInterval(autoCancelIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Main effect for initialization and socket setup
  useEffect(() => {
    if (!bookingId) {
      router.replace("/");
      return;
    }

    const initializePage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Validate access
        await validateAccess();

        // Initialize socket
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
        const socket = io(socketUrl);
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('joinBooking', { bookingId });
        });

        socket.on('bookingUpdate', (data: BookingUpdateData) => {
          if (data.bookingId == bookingId) {
            handleBookingUpdate(data);
          }
        });

        socket.on('driverLocationUpdate', (data: any) => {
          if (driverFound && driverMarkerRef.current && mapRef.current) {
            const newLocation = { lat: data.location.lat, lng: data.location.lng };
            driverMarkerRef.current.setPosition(newLocation);

            // Update route if passenger location available
    if (bookingDetails?.startLatLon) {
      const passengerLatLng = Array.isArray(bookingDetails.startLatLon)
        ? { lat: bookingDetails.startLatLon[0], lng: bookingDetails.startLatLon[1] }
        : { lat: bookingDetails.startLatLon.lat, lng: bookingDetails.startLatLon.lng };

      const stopLatLng = bookingDetails.stopLatLon
        ? Array.isArray(bookingDetails.stopLatLon)
          ? { lat: bookingDetails.stopLatLon[0], lng: bookingDetails.stopLatLon[1] }
          : { lat: bookingDetails.stopLatLon.lat, lng: bookingDetails.stopLatLon.lng }
        : null;

      const google = (window as any).google;
      if (google && google.maps) {
        const directionsService = new google.maps.DirectionsService();
        const routeRenderer = routeRendererRef.current;
        if (routeRenderer) {
          const request: any = {
            origin: newLocation,
            destination: passengerLatLng,
            travelMode: google.maps.TravelMode.DRIVING
          };

          if (stopLatLng) {
            request.waypoints = [
              { location: stopLatLng, stopover: true }
            ];
          }

          directionsService.route(request, (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK) {
              routeRenderer.setDirections(result);
            }
          });
        }
      }
    }
          }
        });

        socket.on('connect_error', (err) => {
          console.error('waiting-for-driver: socket connection error', err);
          setError('Connection error. Please refresh the page.');
        });

        socket.on('disconnect', () => {});

      } catch (err) {
        console.error('waiting-for-driver: page initialization error', err);
        setError('Failed to load booking details. Please try again.');
        setIsLoading(false);
      }
    };

    initializePage();

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanCancel(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto cancel timer (10 minutes)
    autoCancelIntervalRef.current = setInterval(() => {
      setAutoCancelCountdown((prev) => {
        if (prev <= 1) {
          // Auto cancel if no driver assigned
          if (!bookingDetails?.driverId) {
            handleAutoCancel();
          }
          if (autoCancelIntervalRef.current) {
            clearInterval(autoCancelIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (autoCancelIntervalRef.current) {
        clearInterval(autoCancelIntervalRef.current);
      }
    };
  }, [bookingId, router]);

  const validateAccess = async () => {
    try {
      // Check authentication
      const authResponse = await fetch("/api/auth/me", { credentials: "include" });
      if (!authResponse.ok) {
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        return;
      }

      const authData = await authResponse.json();
      const user: User = authData.user;

      // Fetch booking
      const bookingResponse = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
      if (!bookingResponse.ok) {
        if (bookingResponse.status === 401) {
          router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
        } else {
          router.push('/404');
        }
        return;
      }

      const data = await bookingResponse.json();
      const booking: Booking = data.ride || data;

      if (!booking) {
        throw new Error('Booking data is missing');
      }

      const isAdmin = user.role === 'ADMIN' || user.type === 'admin';
      if (!isAdmin && !forceAccess && String(booking.userId) !== String(user.id)) {
        router.push('/404');
        return;
      }

      setBookingDetails(booking);

      // Check current status
      if (booking.driverId && (booking.status === 'DISPATCHED' || booking.status === 'ONGOING')) {
        setDriverFound(true);
        setCanCancel(false); // Hide cancel button when driver is already assigned
        setSearchingStatus("Driver found! Driver is on the way...");
        updateMap(booking);
      } else if (booking.status === 'CONFIRMED' && booking.driverId) {
        setCanCancel(false); // Hide cancel button when driver is assigned
        setSearchingStatus("Driver assigned! Waiting for driver to accept...");
        // Show map if driver location is available
        if (booking.driver?.lastLocation) {
          setDriverFound(true);
          updateMap(booking);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('waiting-for-driver: access validation failed', err);
      setError('Failed to load booking details');
      setIsLoading(false);
      throw err;
    }
  };

  const handleBookingUpdate = (data: BookingUpdateData) => {
    if (data.status === 'CONFIRMED') {
      setSearchingStatus("Driver assigned! Waiting for driver to accept...");
      setCanCancel(false); // Hide cancel button when driver is assigned
      // Stop auto cancel timer
      if (autoCancelIntervalRef.current) {
        clearInterval(autoCancelIntervalRef.current);
        autoCancelIntervalRef.current = null;
      }
      // Fetch updated booking to show driver info
      fetch(`/api/bookings/${bookingId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(updatedData => {
          const updatedBooking: Booking = updatedData.ride || updatedData;
          setBookingDetails(updatedBooking);
          // Show map if driver location is available
          if (updatedBooking.driver?.lastLocation) {
            setDriverFound(true);
            updateMap(updatedBooking);
          }
        })
        .catch(err => console.error('waiting-for-driver: failed to fetch updated booking', err));
    } else if (data.status === 'DISPATCHED' || data.status === 'ONGOING') {
      setDriverFound(true);
      setSearchingStatus("Driver found! Driver is on the way...");
      setCanCancel(false); // Hide cancel button when driver accepts
      // Stop auto cancel timer
      if (autoCancelIntervalRef.current) {
        clearInterval(autoCancelIntervalRef.current);
        autoCancelIntervalRef.current = null;
      }
      // Fetch updated booking
      fetch(`/api/bookings/${bookingId}`, { credentials: 'include' })
        .then(res => res.json())
        .then(updatedData => {
          const updatedBooking: Booking = updatedData.ride || updatedData;
          setBookingDetails(updatedBooking);
          updateMap(updatedBooking);
        })
        .catch(err => console.error('waiting-for-driver: failed to fetch updated booking', err));
    } else if (data.status === 'COMPLETED') {
      setSearchingStatus("Ride completed! Redirecting...");
      setTimeout(() => router.push("/bookings"), 3000);
    } else if (data.status === 'CANCELED') {
      setSearchingStatus("Ride canceled! Redirecting...");
      setTimeout(() => router.push("/bookings"), 3000);
    }
  };

  // Function to periodically refresh booking data
  const refreshBookingData = async () => {
    if (!bookingId) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const updatedBooking: Booking = data.ride || data;

        // Update booking details if changed
        if (JSON.stringify(updatedBooking) !== JSON.stringify(bookingDetails)) {
          setBookingDetails(updatedBooking);

          // Update map if driver location changed
          if (updatedBooking.driver?.lastLocation && driverFound) {
            updateMap(updatedBooking);
          }
        }
      }
    } catch (error) {
      console.error('waiting-for-driver: failed to refresh booking data', error);
    }
  };

  const updateMap = async (booking: Booking) => {
    if (!booking.driver?.lastLocation) {
      console.warn('waiting-for-driver: no driver location available');
      return;
    }

    if (mapError || !mapRef.current) {
      console.warn('waiting-for-driver: map not available, skipping update');
      return;
    }

    const google = (window as any).google;
    const driverLocationRaw = booking.driver.lastLocation;
    const driverLocation: { lat: number; lng: number } = Array.isArray(driverLocationRaw)
      ? { lat: driverLocationRaw[0], lng: driverLocationRaw[1] }
      : { lat: driverLocationRaw.lat, lng: driverLocationRaw.lng };

    const passengerLatLngRaw = booking.startLatLon;
    const passengerLatLng: { lat: number; lng: number } | null = passengerLatLngRaw
      ? Array.isArray(passengerLatLngRaw)
        ? { lat: passengerLatLngRaw[0], lng: passengerLatLngRaw[1] }
        : { lat: passengerLatLngRaw.lat, lng: passengerLatLngRaw.lng }
      : null;

    const stopLatLngRaw = booking.stopLatLon;
    const stopLatLng: { lat: number; lng: number } | null = stopLatLngRaw
      ? Array.isArray(stopLatLngRaw)
        ? { lat: stopLatLngRaw[0], lng: stopLatLngRaw[1] }
        : { lat: stopLatLngRaw.lat, lng: stopLatLngRaw.lng }
      : null;

    if (!passengerLatLng || isNaN(passengerLatLng.lat) || isNaN(passengerLatLng.lng)) {
      console.warn('waiting-for-driver: passenger location not available');
      return;
    }

    // Clear existing markers and route
    if (driverMarkerRef.current) driverMarkerRef.current.setMap(null);
    if (passengerMarkerRef.current) passengerMarkerRef.current.setMap(null);
    if (routeRendererRef.current) routeRendererRef.current.setMap(null);

    // Add driver marker
    driverMarkerRef.current = new google.maps.Marker({
      position: { lat: driverLocation.lat, lng: driverLocation.lng },
      map: mapRef.current,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="white" stroke="black" stroke-width="2"/>
            <path d="M8 15l4-8h16l4 8v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2H12v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V15z" fill="#22c55e"/>
            <circle cx="12" cy="22" r="2" fill="white"/>
            <circle cx="28" cy="22" r="2" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      title: `Driver: ${booking.driver.drFname} ${booking.driver.drLname}`
    });

    // Add passenger marker
    passengerMarkerRef.current = new google.maps.Marker({
      position: passengerLatLng,
      map: mapRef.current,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
            <circle cx="15" cy="15" r="14" fill="white" stroke="black" stroke-width="2"/>
            <circle cx="15" cy="10" r="4" fill="#3b82f6"/>
            <path d="M8 25c0-5 7-8 7-8s7 3 7 8" fill="#3b82f6"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        anchor: new google.maps.Point(15, 15)
      },
      title: 'Pickup Location'
    });

    // Add stop marker if available
    if (stopLatLng) {
      new google.maps.Marker({
        position: stopLatLng,
        map: mapRef.current,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="13" fill="white" stroke="black" stroke-width="2"/>
              <circle cx="14" cy="14" r="5" fill="#f59e0b"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14)
        },
        title: 'Stop Location'
      });
    }

    // Draw route
    const directionsService = new google.maps.DirectionsService();
    routeRendererRef.current = new google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4 }
    });

    const baseRequest: any = {
      origin: { lat: driverLocation.lat, lng: driverLocation.lng },
      destination: passengerLatLng,
      travelMode: google.maps.TravelMode.DRIVING
    };

    if (stopLatLng) {
      baseRequest.waypoints = [
        { location: stopLatLng, stopover: true }
      ];
    }

    directionsService.route(baseRequest, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK && routeRendererRef.current) {
        routeRendererRef.current.setDirections(result);
      } else {
        console.warn('waiting-for-driver: directions request failed', status);
      }
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
    bounds.extend(passengerLatLng);
    if (stopLatLng) {
      bounds.extend(stopLatLng);
    }
    mapRef.current.fitBounds(bounds);

    // Start updating driver location
    const updateDriverLocation = async () => {
      try {
        const response = await fetch(`/api/bookings/${booking.id}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const updatedBooking: Booking = data.ride || data;
          if (updatedBooking.driver?.lastLocation && driverMarkerRef.current) {
            const newLocationRaw = updatedBooking.driver.lastLocation;
            const newLocation = Array.isArray(newLocationRaw)
              ? { lat: newLocationRaw[0], lng: newLocationRaw[1] }
              : { lat: newLocationRaw.lat, lng: newLocationRaw.lng };
            driverMarkerRef.current.setPosition({ lat: newLocation.lat, lng: newLocation.lng });

            // Update route if needed
            if (routeRendererRef.current && passengerLatLng) {
              const refreshRequest: any = {
                origin: { lat: newLocation.lat, lng: newLocation.lng },
                destination: passengerLatLng,
                travelMode: google.maps.TravelMode.DRIVING
              };

              if (stopLatLng) {
                refreshRequest.waypoints = [
                  { location: stopLatLng, stopover: true }
                ];
              }

              directionsService.route(refreshRequest, (result: any, status: any) => {
                if (status === google.maps.DirectionsStatus.OK && routeRendererRef.current) {
                  routeRendererRef.current.setDirections(result);
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('waiting-for-driver: failed to update driver location', err);
      }
    };

    // Clear any existing interval
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
    }

    locationIntervalRef.current = setInterval(updateDriverLocation, 10000);
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !socketRef.current || !bookingId) return;

    const message: ChatMessage = {
      message: chatInput.trim(),
      sender: 'passenger',
      timestamp: new Date().toISOString()
    };

    socketRef.current.emit('sendMessage', {
      bookingId,
      ...message
    });
    setChatInput('');
  };

  const handleCancelBooking = async () => {
    if (!canCancel || !bookingId) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (response.ok) {
        router.push("/bookings");
      } else {
        setError("Failed to cancel booking");
      }
    } catch (err) {
      console.error("waiting-for-driver: failed to cancel booking", err);
      setError("Error canceling booking");
    }
  };

  const handleAutoCancel = async () => {
    if (!bookingId) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (response.ok) {
        setSearchingStatus("Booking auto-canceled due to no driver found. Redirecting...");
        setTimeout(() => router.push("/bookings"), 3000);
      } else {
        setError("Failed to auto-cancel booking");
      }
    } catch (err) {
      console.error("waiting-for-driver: failed to auto-cancel booking", err);
      setError("Error auto-canceling booking");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !bookingDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="text-red-500 text-lg font-semibold mb-4">Error</div>
          <p className="text-gray-600">{error || "Booking not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Upper section - Booking details */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Booking #{bookingDetails.id}</h1>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>From:</span>
              <span className="font-medium">{bookingDetails.pickupAddress}</span>
            </div>
            {bookingDetails.stopAddress && (
              <div className="flex justify-between">
                <span>Stop:</span>
                <span className="font-medium">{bookingDetails.stopAddress}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>To:</span>
              <span className="font-medium">{bookingDetails.dropoffAddress}</span>
            </div>
            <div className="flex justify-between">
              <span>Time:</span>
              <span className="font-medium">
                {new Date(bookingDetails.pickupTime).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Price:</span>
              <span className="font-medium">{bookingDetails.price} DKK</span>
            </div>
          </div>
        </div>

        {/* Map section - Show when driver is found */}
        {driverFound && (
          <div className="border-t border-gray-200">
            {mapError ? (
              <div className="h-64 w-full bg-gray-100 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">🗺️</div>
                  <p>Map unavailable</p>
                  <p className="text-sm">Driver location tracking still active</p>
                </div>
              </div>
            ) : (
              <div id="waiting-map" className="h-64 w-full bg-gray-100 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p>Loading map...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Driver info section - Show when driver is found */}
        {driverFound && bookingDetails?.driver && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                {bookingDetails.driver.profileImage ? (
                  <img src={bookingDetails.driver.profileImage} alt="Driver" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {bookingDetails.driver.drFname} {bookingDetails.driver.drLname}
                </h3>
                <p className="text-gray-600">
                  Vehicle: {bookingDetails.driver.car || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lower section - Searching for car */}
        <div className="p-6 text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-900">{searchingStatus}</p>
          </div>

          {driverFound && (
            <div className="mb-4">
              <button
                onClick={() => setShowChat(!showChat)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                {showChat ? 'Hide Chat' : 'Chat with Driver'}
              </button>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleCancelBooking}
              disabled={!canCancel}
              className={`w-full py-3 px-6 rounded-xl font-semibold transition-colors ${
                canCancel
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Cancel booking
            </button>
            {!canCancel && (
              <p className="text-sm text-gray-500 mt-2">
                ({formatTime(countdown)})
              </p>
            )}
          </div>
        </div>

        {/* Chat Modal */}
        {showChat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-80 h-96 flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Chat with Driver</h3>
                <button onClick={() => setShowChat(false)} className="text-gray-500">✕</button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`mb-2 ${msg.sender === 'passenger' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block p-2 rounded-lg ${msg.sender === 'passenger' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 border rounded-l px-2 py-1"
                  placeholder="Type message..."
                />
                <button onClick={sendMessage} className="bg-blue-500 text-white px-4 py-1 rounded-r">Send</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WaitingForDriverFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  );
}

export default function WaitingForDriverPage() {
  return (
    <Suspense fallback={<WaitingForDriverFallback />}>
      <WaitingForDriverContent />
    </Suspense>
  );
}
