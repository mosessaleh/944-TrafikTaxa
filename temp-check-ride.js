// Use well-known locations for baseline calculation
// Frederikssund center to Harløse to CPH Airport

async function osrmDistance(lat1, lon1, lat2, lon2) {
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error('OSRM failed: ' + r.status);
  const j = await r.json();
  const route = j?.routes?.[0];
  if (!route) throw new Error('No route');
  return { distanceKm: Math.round(route.distance / 100) / 10, durationMin: Math.round(route.duration / 60) };
}

function straightDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function check() {
  // Use approximate coordinates (Google Maps center of each location)
  const points = [
    { name: 'Frederikssund (approx Maglehojparken)', lat: 55.836, lon: 12.065 },
    { name: 'Harlose', lat: 55.907, lon: 12.193 },
    { name: 'CPH Airport', lat: 55.618, lon: 12.650 },
  ];

  // Frederikssund → Harlose → CPH
  // Approx: 55.836,12.065 → 55.907,12.193 → 55.618,12.650

  console.log('\n--- Leg 1: Frederikssund → Harlose (OSRM) ---');
  const leg1 = await osrmDistance(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  const s1 = straightDist(points[0].lat, points[0].lon, points[1].lat, points[1].lon);
  console.log(`OSRM: ${leg1.distanceKm} km, ${leg1.durationMin} min | Straight: ${s1.toFixed(1)} km`);

  console.log('\n--- Leg 2: Harlose → CPH Airport (OSRM) ---');
  const leg2 = await osrmDistance(points[1].lat, points[1].lon, points[2].lat, points[2].lon);
  const s2 = straightDist(points[1].lat, points[1].lon, points[2].lat, points[2].lon);
  console.log(`OSRM: ${leg2.distanceKm} km, ${leg2.durationMin} min | Straight: ${s2.toFixed(1)} km`);

  const td = leg1.distanceKm + leg2.distanceKm;
  const tt = leg1.durationMin + leg2.durationMin;
  const totalStraight = s1 + s2;
  console.log(`\n=== TOTAL ===`);
  console.log(`OSRM: ${td.toFixed(1)} km, ${tt} min`);
  console.log(`Straight: ${totalStraight.toFixed(1)} km`);
  console.log(`OSRM/Straight ratio: ${(td/totalStraight).toFixed(2)}x`);

  // Price calculations (Saturday = weekend rates)
  const base=60, perKm=16, perMin=7;
  
  // Calculate with OSRM distances
  const priceOsm = Math.round(base + perKm * td + perMin * tt);
  console.log(`\nOSRM price: ${base} + ${perKm}*${td.toFixed(1)} + ${perMin}*${tt} = ${priceOsm} DKK`);
  
  // Calculate what distances would give 2756
  // 2756-60=2696, typical road/straight ratio is 1.3-1.5
  const estDist2756 = 2696 / (perKm + perMin * 1.1); // assuming t = 1.1*d
  console.log(`\n2756 DKK would need approx ${estDist2756.toFixed(0)} km road distance`);
  
  // Calculate what gives 1898
  const estDist1898 = 1838 / (perKm + perMin * 1.1);
  console.log(`1898 DKK would need approx ${estDist1898.toFixed(0)} km road distance`);
}

check().catch(e => console.error(e));
