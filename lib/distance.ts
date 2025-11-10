export async function estimateDistanceTime(pickup: string, dropoff: string): Promise<{ distanceKm: number; durationMin: number }>{
  // Helper: parse lat,lng if user provided coordinates like "55.676,12.568"
  function parseLatLng(s: string): { lat: number; lon: number } | null {
    const m = s.trim().match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const lat = Number(m[1]); const lon = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  }

  // Haversine distance in kilometers
  function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }){
    const R = 6371; // km
    const toRad = (d:number)=> d * Math.PI/180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const la = toRad(a.lat);
    const lb = toRad(b.lat);
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const c = 2 * Math.asin(Math.sqrt(sinDLat*sinDLat + Math.cos(la)*Math.cos(lb)*sinDLon*sinDLon));
    return R * c;
  }

  async function geocodeNominatim(q: string): Promise<{ lat: number; lon: number } | null> {
    try{
      // Nominatim usage policy: include a proper User-Agent identifying your application
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'User-Agent': '944-Trafik/1.0 (contact: trafik@944.dk)'} });
      if (!res.ok) return null;
      const j = await res.json();
      if (!Array.isArray(j) || j.length === 0) return null;
      const r = j[0];
      return { lat: Number(r.lat), lon: Number(r.lon) };
    }catch(e){
      console.error('[distance] nominatim error', e);
      return null;
    }
  }

  async function routeOsrm(a:{lat:number,lon:number}, b:{lat:number,lon:number}): Promise<{distanceKm:number, durationMin:number} | null> {
    try{
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;
      const res = await fetch(url, { headers: { 'User-Agent': '944-Trafik/1.0' } });
      if (!res.ok) {
        console.warn('[distance] OSRM returned', res.status);
        return null;
      }
      const j = await res.json();
      if (!j || j.code !== 'Ok' || !Array.isArray(j.routes) || j.routes.length===0) return null;
      const route = j.routes[0];
      const distanceKm = Number(route.distance) / 1000;
      const durationMin = Math.round(Number(route.duration) / 60);
      return { distanceKm, durationMin };
    }catch(e){
      console.error('[distance] osrm error', e);
      return null;
    }
  }

  // 1) Try parse coordinates directly
  let a = parseLatLng(pickup);
  let b = parseLatLng(dropoff);

  // 2) Geocode if needed
  if (!a) a = await geocodeNominatim(pickup);
  if (!b) b = await geocodeNominatim(dropoff);

  // 3) If we have both coordinates, try OSRM routing
  if (a && b){
    const route = await routeOsrm(a,b);
    if (route) return route;
    // fallback to great-circle estimate
    const km = haversineKm(a,b);
    // assume average speed 40 km/h => minutes
    const durationMin = Math.max(1, Math.round(km / 40 * 60));
    return { distanceKm: Number(km.toFixed(2)), durationMin };
  }

  // 4) If we don't have coordinates for both, try partial geocode
  if (!a && !b){
    throw new Error('Unable to geocode pickup or dropoff');
  }
  // if one is missing, we cannot route; return error or fallback
  throw new Error('Insufficient location data');
}
