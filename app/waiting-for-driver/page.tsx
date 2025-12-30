"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import io from 'socket.io-client';

export default function WaitingForDriverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const forceAccess = searchParams.get("force") === "true"; // Development override

  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [countdown, setCountdown] = useState(180); // 3 minutes in seconds
   const [canCancel, setCanCancel] = useState(false);
   const [searchingStatus, setSearchingStatus] = useState<string>("Searching for a driver...");
   const [driverFound, setDriverFound] = useState(false);
   const mapRef = useRef<any>(null);
   const [mapInstance, setMapInstance] = useState<any>(null);
   const driverMarkerRef = useRef<any>(null);
   const passengerMarkerRef = useRef<any>(null);
   const routePolylineRef = useRef<any>(null);
   const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
   const socketRef = useRef<any>(null);
   const [chatMessages, setChatMessages] = useState<any[]>([]);
   const [chatInput, setChatInput] = useState('');
   const [showChat, setShowChat] = useState(false);

  // Initialize Google Maps
  useEffect(() => {
    const initializeMap = async () => {
      if (typeof window === 'undefined' || mapInstance) return;

      // Load Google Maps API if not already loaded
      if (!(window as any).google) {
        (window as any).initGoogleMapsWaiting = () => {};
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,directions&language=da&callback=initGoogleMapsWaiting`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          const checkGoogle = () => {
            if ((window as any).google) resolve(null);
            else setTimeout(checkGoogle, 100);
          };
          checkGoogle();
        });
      }

      const google = (window as any).google;
      const mapContainer = document.getElementById('waiting-map');
      if (!mapContainer) return;

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

  // Play sound when driver is found
  useEffect(() => {
    if (driverFound) {
      try {
        // Create a simple beep sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency in Hz
        oscillator.type = 'sine'; // Waveform type

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Volume
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); // Fade out

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5); // Duration
      } catch (error) {
        console.warn('Could not play notification sound:', error);
      }
    }
  }, [driverFound]);

  // Initialize chat socket when driver is found
  useEffect(() => {
    if (driverFound && bookingId) {
      const socket = io();
      socketRef.current = socket;

      socket.emit('joinChat', { bookingId });

      socket.on('newMessage', (data: any) => {
        setChatMessages(prev => [...prev, data]);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [driverFound, bookingId]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!bookingId) {
      router.replace("/");
      return;
    }

    // Validate access conditions
    const validateAccess = async () => {
      try {
        // Check if user is logged in
        const authResponse = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!authResponse.ok) {
          router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
          return;
        }

        const authData = await authResponse.json();
        const user = authData.user;

        // Fetch booking details
        const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
          credentials: "include",
        });

        if (!bookingResponse.ok) {
          if (bookingResponse.status === 401) {
            router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
          } else {
            router.push('/404');
          }
          return;
        }

        const data = await bookingResponse.json();
        const booking = data.ride || data;

        if (!booking) {
          setSearchingStatus("Error: Booking data is missing");
          return;
        }

        // Check ownership with proper type conversion
        const bookingUserId = String(booking.userId);
        const currentUserId = String(user.id);
        const isAdmin = (user as any).role === 'ADMIN' || (user as any).type === 'admin';

        // Allow admin access to any booking, owner access, or force access for development
        if (!isAdmin && !forceAccess && bookingUserId !== currentUserId) {
          router.push('/404');
          return;
        }

        setBookingDetails(booking);

        // Check if driver is already assigned
         if (booking.driverId && (booking.status === 'DISPATCHED' || booking.status === 'ONGOING')) {
           setDriverFound(true);
           setSearchingStatus("Driver found! Driver is on the way...");
           updateMap(booking);
           // Do not redirect, stay on this page until ride completes
           return;
         }

        // Check if booking is confirmed (driver assigned but not accepted yet)
        if (booking.status === 'CONFIRMED') {
          setSearchingStatus("Driver assigned! Waiting for driver to accept...");
          // Continue to check status
        }

        // Note: Pending rides are processed by the background service in server.js
        // No need to process them here to avoid duplicate processing

        // Start checking booking status
        const checkInterval = setInterval(async () => {
          try {
            console.log(`[WAITING] Checking booking ${bookingId} status...`);
            const rideResponse = await fetch(`/api/bookings/${bookingId}`, {
              credentials: "include",
            });
            if (rideResponse.ok) {
              const rideData = await rideResponse.json();
              const ride = rideData.ride || rideData;
              console.log(`[WAITING] Booking ${bookingId} status: ${ride.status}, driverId: ${ride.driverId}, car: ${ride.car}`);
              if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
                console.log(`[WAITING] Driver found for booking ${bookingId}`);
                clearInterval(checkInterval);
                clearInterval(processInterval);
                setDriverFound(true);
                setSearchingStatus("Driver found! Driver is on the way...");
                updateMap(ride);
                // Continue checking for ride completion
                const completionInterval = setInterval(async () => {
                  try {
                    const rideResponse = await fetch(`/api/bookings/${bookingId}`, { credentials: "include" });
                    if (rideResponse.ok) {
                      const rideData = await rideResponse.json();
                      const ride = rideData.ride || rideData;
                      if (ride.status === 'COMPLETED') {
                        clearInterval(completionInterval);
                        setSearchingStatus("Ride completed! Redirecting...");
                        setTimeout(() => router.push("/bookings"), 3000);
                      }
                    }
                  } catch (error) {
                    console.error("Failed to check ride completion:", error);
                  }
                }, 5000); // Check every 5 seconds for completion
              }
            } else {
              console.log(`[WAITING] Failed to fetch booking ${bookingId}, status: ${rideResponse.status}`);
            }
          } catch (error) {
            console.error("Failed to check ride status:", error);
          }
        }, 1000);

        // Clean up intervals after 5 minutes (maximum wait time)
        setTimeout(() => {
          clearInterval(checkInterval);
        }, 300000); // 5 minutes

      } catch (error) {
        console.error("❌ Failed to validate access:", error);
        router.push('/404');
      }
    };

    validateAccess();

    // Countdown timer for cancel button
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

    return () => {
      clearInterval(timer);
    };
  }, [bookingId, router]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update map with driver and passenger locations
  const updateMap = async (booking: any) => {
    if (!mapInstance || !booking.driver) return;

    const google = (window as any).google;
    const driverLocation = booking.driver.lastLocation;
    if (!driverLocation || !driverLocation.lat || !driverLocation.lon) return;

    const passengerLatLng = booking.startLatLon ? { lat: booking.startLatLon[0], lng: booking.startLatLon[1] } : null;
    if (!passengerLatLng) return;

    // Clear existing markers and polyline
    if (driverMarkerRef.current) driverMarkerRef.current.setMap(null);
    if (passengerMarkerRef.current) passengerMarkerRef.current.setMap(null);
    if (routePolylineRef.current) routePolylineRef.current.setMap(null);

    // Add driver marker
    driverMarkerRef.current = new google.maps.Marker({
      position: { lat: driverLocation.lat, lng: driverLocation.lon },
      map: mapInstance,
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
      map: mapInstance,
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

    // Draw route
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4 }
    });

    directionsService.route({
      origin: { lat: driverLocation.lat, lng: driverLocation.lon },
      destination: passengerLatLng,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
        routePolylineRef.current = directionsRenderer;
      }
    });

    // Fit bounds
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lon });
    bounds.extend(passengerLatLng);
    mapInstance.fitBounds(bounds);

    // Start updating driver location every 10 seconds
    const updateDriverLocation = async () => {
      try {
        const response = await fetch(`/api/bookings/${booking.id}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          const updatedBooking = data.ride || data;
          if (updatedBooking.driver && updatedBooking.driver.lastLocation) {
            const newLocation = updatedBooking.driver.lastLocation;
            if (driverMarkerRef.current) {
              driverMarkerRef.current.setPosition({ lat: newLocation.lat, lng: newLocation.lon });
            }
          }
        }
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    };

    locationIntervalRef.current = setInterval(updateDriverLocation, 10000);
  };

  const sendMessage = () => {
    if (chatInput.trim() && socketRef.current && bookingId) {
      socketRef.current.emit('sendMessage', {
        bookingId,
        message: chatInput.trim(),
        sender: 'passenger'
      });
      setChatMessages(prev => [...prev, {
        message: chatInput.trim(),
        sender: 'passenger',
        timestamp: new Date().toISOString()
      }]);
      setChatInput('');
    }
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
        alert("Failed to cancel booking");
      }
    } catch (error) {
      console.error("Error canceling booking:", error);
      alert("Error canceling booking");
    }
  };

  if (!bookingDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
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
             <div id="waiting-map" className="h-64 w-full"></div>
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