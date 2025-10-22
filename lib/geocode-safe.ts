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

async function geocode(addr:string){
  const u = new URL('https://nominatim.openstreetmap.org/search');
  u.searchParams.set('format','json');
  u.searchParams.set('q', addr);
  u.searchParams.set('limit','1');
  const r = await fetch(u, { headers:{'Accept':'application/json','User-Agent':'944-trafik-app'}, next:{ revalidate: 0 } });
  if(!r.ok) throw new Error('Geocode failed');
  const j:any[] = await r.json();
  const p = j?.[0]; if(!p) throw new Error('No geocode');
  return { lat: Number(p.lat), lon: Number(p.lon) };
}

export type LocInput = { address?: string|null; lat?: number|null; lon?: number|null };

export async function safeEstimateDistance(a: LocInput, b: LocInput){
  // 1) Prefer coordinates when available
  if (Number.isFinite(a.lat as any) && Number.isFinite(a.lon as any) && Number.isFinite(b.lat as any) && Number.isFinite(b.lon as any)){
    return osrmDistance(a.lat as number, a.lon as number, b.lat as number, b.lon as number);
  }
  // 2) Fallback to text addresses (sanitize)
  const at = (a.address||'').trim();
  const bt = (b.address||'').trim();
  if (badText(at) || badText(bt)) throw new Error('Invalid address input');
  const A = await geocode(at);
  const B = await geocode(bt);
  return osrmDistance(A.lat, A.lon, B.lat, B.lon);
}
