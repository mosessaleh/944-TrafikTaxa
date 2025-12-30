// @ts-ignore
const CacheManager = require('./cache').CacheManager;

// Haversine distance calculation (fallback)
function calculateDistance(lat1: any, lon1: any, lat2: any, lon2: any) {
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

function toRadians(degrees: any) {
  return degrees * (Math.PI / 180);
}

// Get distance and duration using Google Distance Matrix API (batch)
async function getDistanceAndDuration(origins: any, destinations: any) {
  // Assume single origin for simplicity (as used in vehicle selection)
  const origin = origins[0];
  if (!origin) return destinations.map(() => null);

  const results: ({ distance: number; duration: number } | null)[] = [];

  // Check cache first for each destination
  for (const dest of destinations) {
    const cached = CacheManager.getDistanceCache(origin.lat, origin.lng, dest.lat, dest.lng);
    if (cached) {
      results.push(cached);
    } else {
      results.push(null); // Mark for API call
    }
  }

  // If all results are cached, return them
  if (results.every(r => r !== null)) {
    return results as ({ distance: number; duration: number })[];
  }

  // Prepare uncached destinations
  const uncachedIndices: number[] = [];
  const uncachedDestinations: { lat: number; lng: number }[] = [];
  results.forEach((result, index) => {
    if (result === null) {
      uncachedIndices.push(index);
      uncachedDestinations.push(destinations[index]);
    }
  });

  if (uncachedDestinations.length === 0) {
    return results as ({ distance: number; duration: number })[];
  }

  // Call API for uncached destinations
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const originsStr = `${origin.lat},${origin.lng}`;
    const destinationsStr = uncachedDestinations.map(d => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&mode=driving&units=metric&departure_time=now&traffic_model=best_guess&key=${apiKey}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn('Distance Matrix API error:', response.status);
      // Fill uncached results with null
      uncachedIndices.forEach(index => results[index] = null);
      return results;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements) {
      console.warn('Distance Matrix API returned invalid data:', data.status);
      // Fill uncached results with null
      uncachedIndices.forEach(index => results[index] = null);
      return results;
    }

    const elements = data.rows[0].elements;
    elements.forEach((element: any, apiIndex: number) => {
      const resultIndex = uncachedIndices[apiIndex];
      if (element.status !== 'OK') {
        console.warn('Distance Matrix element status:', element.status);
        results[resultIndex] = null;
      } else {
        const distanceData = {
          distance: element.distance.value / 1000, // Convert meters to km
          duration: (element.duration_in_traffic?.value || element.duration.value) / 60 // Convert seconds to minutes, prefer traffic-aware duration
        };
        results[resultIndex] = distanceData;
        // Cache the result
        const dest = uncachedDestinations[apiIndex];
        CacheManager.setDistanceCache(origin.lat, origin.lng, dest.lat, dest.lng, distanceData.distance, distanceData.duration);
      }
    });
  } catch (error) {
    console.warn('Distance Matrix API failed:', error);
    // Fill uncached results with null
    uncachedIndices.forEach(index => results[index] = null);
  }

  return results;
}

// Legacy function for single destination (backwards compatibility)
async function getDistanceAndDurationSingle(origins: any, destination: any) {
  const results = await getDistanceAndDuration(origins, [destination]);
  return results[0];
}

// Estimate arrival time in minutes based on distance
// Assuming average speed of 30 km/h in city traffic
function estimateArrivalTime(distanceKm: any) {
  const averageSpeedKmh = 30; // km/h
  const timeHours = distanceKm / averageSpeedKmh;
  const timeMinutes = timeHours * 60;
  return Math.ceil(timeMinutes); // Round up to next minute
}

// Format time for display
function formatArrivalTime(minutes: any) {
  if (minutes < 1) return "less than 1 minute";
  if (minutes === 1) return "1 minute";
  return `${minutes} minutes`;
}

module.exports = {
  calculateDistance,
  getDistanceAndDuration,
  getDistanceAndDurationSingle,
  estimateArrivalTime,
  formatArrivalTime
};
