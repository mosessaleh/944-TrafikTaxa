import { CacheManager } from '@/lib/cache';

function badText(a: string){
  const s = (a||'').trim();
  if (!s) return true;
  if (s.length > 200) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/[<>]/.test(s)) return true;
  return false;
}

async function osrmDistance(lat1:number, lon1:number, lat2:number, lon2:number){
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const r = await fetch(url, { headers:{'Accept':'application/json'}, next:{ revalidate:0 } });
  if(!r.ok) throw new Error('OSRM failed');
  const j = await r.json();
  const route = j?.routes?.[0];
  if(!route) throw new Error('No route');
  const distanceKm = route.distance / 1000;
  const durationMin = Math.max(1, Math.round(route.duration / 60));
  return { distanceKm, durationMin };
}

async function geocode(addr:string): Promise<{ lat: number; lon: number }> {
  // Check cache first
  const cached = CacheManager.getGeoCache(addr);
  if (cached) {
    return cached;
  }

  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format','json');
  u.searchParams.set('q', addr);
  u.searchParams.set('limit','1');
  const r = await fetch(u, { headers:{'Accept':'application/json','User-Agent':'944-trafik-app'}, next:{ revalidate: 0 } });
  if(!r.ok) throw new Error('Geocode failed');
  const j:any[] = await r.json();
  const p = j?.[0]; if(!p) throw new Error('No geocode');

  // Validate match quality — reject low-confidence results
  const displayName = (p.display_name || '').toLowerCase();
  const queryLower = addr.toLowerCase();
  const osmType = (p.type || '');

  // If result is just a city/town/postcode but user typed a street, reject
  const broadTypes = ['administrative', 'city', 'town', 'municipality', 'county', 'postcode', 'boundary', 'postal_code'];
  const isBroadResult = broadTypes.includes(osmType);
  const hasStreetTerms = /\b(vej|gade|stræde|alle|boulevard|plads|torv|road|street|avenue|lane|drive|court|way|close|park|plaats|شا|شارع|طريق|ساحة|weg|steeg|gracht|kade|singel|laan|hof|pad|dreef|plantsoen)\b/i.test(queryLower);
  // Also detect if user typed numbers that look like a street number (e.g. "18", "137") not present in result
  const hasStreetNumber = /\b\d{1,4}\b/.test(queryLower);
  const resultHasStreetNumber = /\b\d{1,4}\b/.test(displayName);

  if (isBroadResult && hasStreetTerms) {
    throw new Error(`Broad match for specific query: "${addr}" → "${displayName}" (${osmType})`);
  }

  // If user typed a street number but result doesn't contain one, likely a non-existent address
  if (hasStreetNumber && !resultHasStreetNumber && hasStreetTerms) {
    throw new Error(`Missing street number in result: "${addr}" → "${displayName}"`);
  }

  const result = { lat: Number(p.lat), lon: Number(p.lon) };
  CacheManager.setGeoCache(addr, result);
  return result;
}

export type LocInput = { address?: string|null; lat?: number|null; lon?: number|null };

export async function safeEstimateDistance(a: LocInput, b: LocInput){
  console.log('[DEBUG] safeEstimateDistance called with:', { a, b });

  // 1) Prefer coordinates when available
  if (Number.isFinite(a.lat as any) && Number.isFinite(a.lon as any) && Number.isFinite(b.lat as any) && Number.isFinite(b.lon as any)){
    console.log('[DEBUG] Using coordinates for OSRM');
    try {
      const result = await osrmDistance(a.lat as number, a.lon as number, b.lat as number, b.lon as number);
      console.log('[DEBUG] OSRM success:', result);
      return result;
    } catch (error) {
      console.warn('[DEBUG] OSRM routing failed, falling back to straight-line distance:', error);
      // Fallback to straight-line distance calculation
      const { calculateDistance, estimateArrivalTime } = await import('@/lib/distance');
      const distanceKm = calculateDistance(a.lat as number, a.lon as number, b.lat as number, b.lon as number);
      const durationMin = estimateArrivalTime(distanceKm);
      console.log('[DEBUG] Fallback result:', { distanceKm, durationMin });
      return { distanceKm, durationMin };
    }
  }
  // 2) Fallback to text addresses (sanitize)
  console.log('[DEBUG] Using addresses for geocoding');
  const at = (a.address||'').trim();
  const bt = (b.address||'').trim();
  if (badText(at) || badText(bt)) throw new Error('Invalid address input');
  const A = await geocode(at);
  const B = await geocode(bt);
  console.log('[DEBUG] Geocoded addresses:', { A, B });
  try {
    const result = await osrmDistance(A.lat, A.lon, B.lat, B.lon);
    console.log('[DEBUG] OSRM success for geocoded:', result);
    return result;
  } catch (error) {
    console.warn('[DEBUG] OSRM routing failed for geocoded addresses, falling back to straight-line distance:', error);
    // Fallback to straight-line distance calculation
    const { calculateDistance, estimateArrivalTime } = await import('@/lib/distance');
    const distanceKm = calculateDistance(A.lat, A.lon, B.lat, B.lon);
    const durationMin = estimateArrivalTime(distanceKm);
    console.log('[DEBUG] Fallback result for geocoded:', { distanceKm, durationMin });
    return { distanceKm, durationMin };
  }
}
