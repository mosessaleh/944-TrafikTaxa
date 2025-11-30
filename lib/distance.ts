// Haversine distance calculation
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
