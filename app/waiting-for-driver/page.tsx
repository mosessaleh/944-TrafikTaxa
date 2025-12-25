"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function WaitingForDriverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const forceAccess = searchParams.get("force") === "true"; // Development override

  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [countdown, setCountdown] = useState(180); // 3 minutes in seconds
  const [canCancel, setCanCancel] = useState(false);
  const [searchingStatus, setSearchingStatus] = useState<string>("");
  const [offerCountdown, setOfferCountdown] = useState<number | null>(null);
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);
  const [driverAccepted, setDriverAccepted] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([]);
  const [currentVehicleIndex, setCurrentVehicleIndex] = useState(0);
  const bookingRef = useRef<any>(null);
  const excludedDrivers = useRef<{ [driverId: string]: number }>({});

  useEffect(() => {
    if (!bookingId) {
      router.replace("/");
      return;
    }

    let hasValidated = false;

    // Prevent page unload only after validation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasValidated) return; // Don't show warning during initial load
      e.preventDefault();
      e.returnValue = "You will lose your booking if you continue. Are you sure?";
      return "You will lose your booking if you continue. Are you sure?";
    };

    const handleUnload = async () => {
      // Cancel the booking when user leaves the page after validation
      if (bookingId && hasValidated) {
        try {
          await fetch(`/api/bookings/${bookingId}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
        } catch (error) {
          console.error("Failed to cancel booking on page unload:", error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

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
        bookingRef.current = booking;
        setIsValid(true);
        hasValidated = true;

        // If driver is already assigned, wait for acceptance
        if (booking.driverId) {
          setCurrentDriverId(booking.driverId);
          setSearchingStatus("Waiting for driver response...");
          setOfferCountdown(30);

          // Check acceptance every second
          const checkInterval = setInterval(async () => {
            try {
              const rideResponse = await fetch(`/api/bookings/${bookingId}`);
              if (rideResponse.ok) {
                const rideData = await rideResponse.json();
                const ride = rideData.ride || rideData;
                if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
                  clearInterval(checkInterval);
                  setDriverAccepted(true);
                  setSearchingStatus("Driver found! Redirecting...");
                  setTimeout(() => router.push("/bookings"), 3000);
                }
              }
            } catch (error) {
              console.error("Failed to check ride status:", error);
            }
          }, 1000);

          // Handle timeout
          setTimeout(async () => {
            clearInterval(checkInterval);
            if (!driverAccepted) {
              // Driver didn't accept - exclude for 1 minute
              excludedDrivers.current[booking.driverId] = Date.now() + 60000;

              // Driver didn't accept
              console.log(`waiting-for-driver: Setting driver ${booking.driverId} to busy after timeout`);
              const response = await fetch(`/api/drivers/${booking.driverId}/ride`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentRideId: null, isBusy: true })
              });
              if (response.ok) {
                console.log(`waiting-for-driver: Driver ${booking.driverId} set to busy`);
              } else {
                console.error('Failed to update driver status');
              }

              // Deduct rating
              await fetch(`/api/drivers/${booking.driverId}/rating`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deduct: 0.01 })
              });

              // Try next vehicle or restart search
              setOfferCountdown(null);
              setCurrentDriverId(null);
              setSearchingStatus("Searching for a car");
              setTimeout(() => {
                const nextIndex = currentVehicleIndex + 1;
                if (nextIndex < availableVehicles.length) {
                  setCurrentVehicleIndex(nextIndex);
                  const nextVehicleId = availableVehicles[nextIndex];
                  assignRideToDriver(bookingRef.current.id, nextVehicleId);
                } else {
                  // No more vehicles in list, get new list
                  startCarSearch(bookingRef.current);
                }
              }, 1000);
            }
          }, 30000);
        } else {
          // Start searching for cars after validation
          if (booking.startLatLon) {
            startCarSearch(booking);
          } else {
            setSearchingStatus("Error: Booking location data is missing");
          }
        }
        hasValidated = true;
      } catch (error) {
        console.error("❌ Failed to validate access:", error);
        router.push('/404');
      }
    };

    const startCarSearch = async (booking: any) => {
      if (!booking) {
        setSearchingStatus("Error: Invalid booking data");
        return;
      }
      if (!booking.startLatLon) {
        setSearchingStatus("Error: Invalid booking data");
        return;
      }

      setSearchingStatus("Searching for a car");
      try {
        // If we don't have vehicles yet, call vehicle selection API
        if (availableVehicles.length === 0) {
          const excludedIds = Object.keys(excludedDrivers.current)
            .filter(id => excludedDrivers.current[id] > Date.now())
            .map(id => parseInt(id));
          const selectionResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/vehicle-selection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pickupLat: booking.startLatLon?.lat,
              pickupLon: booking.startLatLon?.lon,
              dropoffLat: booking.endLatLon?.lat,
              dropoffLon: booking.endLatLon?.lon,
              vehicleTypeId: booking.vehicleTypeId,
              maxVehicles: 3,
              excludedDriverIds: excludedIds
            })
          });

          if (selectionResponse.ok) {
            const selectionData = await selectionResponse.json();
            if (selectionData.ok && selectionData.vehicles?.length > 0) {
              setAvailableVehicles(selectionData.vehicles);
              setCurrentVehicleIndex(0);
              const closestVehicleId = selectionData.vehicles[0];
              await assignRideToDriver(booking.id, closestVehicleId);
            } else {
              // No vehicles available, try again in 10 seconds
              setTimeout(() => startCarSearch(booking), 10000);
            }
          }
        } else {
          // Try next vehicle in the list
          const nextIndex = currentVehicleIndex + 1;
          if (nextIndex < availableVehicles.length) {
            setCurrentVehicleIndex(nextIndex);
            const nextVehicleId = availableVehicles[nextIndex];
            await assignRideToDriver(booking.id, nextVehicleId);
          } else {
            // All vehicles tried, search again in 10 seconds
            setAvailableVehicles([]);
            setCurrentVehicleIndex(0);
            setTimeout(() => startCarSearch(booking), 10000);
          }
        }
      } catch (error) {
        console.error("Failed to search for cars:", error);
        // Retry after 10 seconds
        setTimeout(() => startCarSearch(booking), 10000);
      }
    };

    const assignRideToDriver = async (rideId: string, vehicleId: string) => {
      try {
        // Find driver for this vehicle
        const driverResponse = await fetch(`/api/admin/vehicles/${vehicleId}/driver`);
        if (driverResponse.ok) {
          const driverData = await driverResponse.json();
          if (driverData.driver) {
            const driverId = driverData.driver.id;

            // Check if driver is excluded
            const excludedUntil = excludedDrivers.current[driverId];
            if (excludedUntil && excludedUntil > Date.now()) {
              // Try next vehicle in current list
              const nextIndex = currentVehicleIndex + 1;
              if (nextIndex < availableVehicles.length) {
                setCurrentVehicleIndex(nextIndex);
                const nextVehicleId = availableVehicles[nextIndex];
                setTimeout(() => assignRideToDriver(bookingRef.current.id, nextVehicleId), 1000);
              } else {
                // No more vehicles in list, get new list
                setTimeout(() => {
                  if (bookingRef.current?.startLatLon) {
                    startCarSearch(bookingRef.current);
                  } else {
                    setSearchingStatus("Error: Cannot find available drivers");
                  }
                }, 1000);
              }
              return;
            }
            setCurrentDriverId(driverId);

            // Update ride with assigned vehicle info
            const vehicleResponse = await fetch(`/api/admin/vehicles/${vehicleId}`);
            if (vehicleResponse.ok) {
              const vehicleData = await vehicleResponse.json();
              const vehicle = vehicleData.vehicle;
              if (vehicle) {
                await fetch(`/api/bookings/${rideId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    explanation: `Assigned vehicle: ${vehicle.regNumber} (selected by strategy)`
                  })
                });
              }
            }

            // Update driver with currentRideId
            await fetch(`/api/drivers/${driverId}/ride`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentRideId: rideId, rideAccepted: 0 })
            });

            // Start 30-second countdown
            setOfferCountdown(30);
            setSearchingStatus("Waiting for driver response...");

            // Check acceptance every second
            const checkInterval = setInterval(async () => {
              try {
                const rideResponse = await fetch(`/api/bookings/${bookingRef.current.id}`);
                if (rideResponse.ok) {
                  const rideData = await rideResponse.json();
                  const ride = rideData.ride || rideData;
                  if (ride.status === 'DISPATCHED' || ride.status === 'ONGOING') {
                    clearInterval(checkInterval);
                    setDriverAccepted(true);
                    setSearchingStatus("Driver found! Redirecting...");
                    setTimeout(() => router.push("/bookings"), 3000);
                  }
                }
              } catch (error) {
                console.error("Failed to check ride status:", error);
              }
            }, 1000);

            // Handle timeout
            setTimeout(async () => {
              clearInterval(checkInterval);
              if (!driverAccepted) {
                // Driver didn't accept - exclude for 1 minute
                excludedDrivers.current[driverId] = Date.now() + 60000; // 1 minute from now

                // Driver didn't accept
                await fetch(`/api/drivers/${driverId}/ride`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ currentRideId: null, isBusy: true })
                });

                // Deduct rating
                await fetch(`/api/drivers/${driverId}/rating`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deduct: 0.01 })
                });

                // Try next vehicle in the list
                setOfferCountdown(null);
                setCurrentDriverId(null);
                setSearchingStatus("Searching for a car");
                setTimeout(() => {
                  const nextIndex = currentVehicleIndex + 1;
                  if (nextIndex < availableVehicles.length) {
                    setCurrentVehicleIndex(nextIndex);
                    const nextVehicleId = availableVehicles[nextIndex];
                    assignRideToDriver(bookingRef.current.id, nextVehicleId);
                  } else {
                    // No more vehicles in list, get new list
                    if (bookingRef.current?.startLatLon) {
                      startCarSearch(bookingRef.current);
                    } else {
                      setSearchingStatus("Error: Cannot find available drivers");
                    }
                  }
                }, 1000);
              }
            }, 30000);
          }
        }
      } catch (error) {
        console.error("Failed to assign ride to driver:", error);
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
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [bookingId, router]);

  // Offer countdown timer
  useEffect(() => {
    if (offerCountdown === null || offerCountdown <= 0) return;

    const offerTimer = setInterval(() => {
      setOfferCountdown((prev) => {
        if (prev && prev <= 1) {
          return 0;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(offerTimer);
  }, [offerCountdown]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

        {/* Lower section - Searching for car */}
        <div className="p-6 text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-900">{searchingStatus}</p>
            {offerCountdown !== null && (
              <p className="text-sm text-gray-500 mt-2">{offerCountdown} seconds remaining</p>
            )}
          </div>

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
      </div>
    </div>
  );
}