// Haversine distance calculation (fallback)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Get distance and duration using Google Distance Matrix API
export async function getDistanceAndDuration(
  origins: { lat: number; lng: number }[],
  destinations: { lat: number; lng: number }[]
): Promise<{ distance: number; duration: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&mode=driving&units=metric&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn('Distance Matrix API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      console.warn('Distance Matrix API returned invalid data:', data.status);
      return null;
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
      console.warn('Distance Matrix element status:', element.status);
      return null;
    }

    return {
      distance: element.distance.value / 1000, // Convert meters to km
      duration: (element.duration_in_traffic?.value || element.duration.value) / 60 // Convert seconds to minutes, prefer traffic-aware duration
    };
  } catch (error) {
    console.warn('Distance Matrix API failed:', error);
    return null;
  }
}

// Estimate arrival time in minutes based on distance
// Assuming average speed of 30 km/h in city traffic
export function estimateArrivalTime(distanceKm: number): number {
  const averageSpeedKmh = 30; // km/h
  const timeHours = distanceKm / averageSpeedKmh;
  const timeMinutes = timeHours * 60;
  return Math.ceil(timeMinutes); // Round up to next minute
}

// Format time for display
export function formatArrivalTime(minutes: number): string {
  if (minutes < 1) return "less than 1 minute";
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}
