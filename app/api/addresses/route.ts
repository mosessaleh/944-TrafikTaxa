import { NextResponse } from 'next/server';

// Proxy to DAWA (official DK address API) with light sanitization & limits
// Docs: https://api.dataforsyningen.dk/adresser

function bad(q: string){
  if (!q) return true;
  if (q.length > 120) return true;
  if (/[<>]/.test(q)) return true;
  return false;
}

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const q = (url.searchParams.get('q')||'').trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit')||'8')));
    if (bad(q)) return NextResponse.json({ ok:true, suggestions: [] });

    // Use DAWA API for real Danish addresses
    // Docs: https://api.dataforsyningen.dk/adresser
    const dawaUrl = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(q)}&per_side=${limit}&sortering=adresse`;
    console.log("Fetching from DAWA:", dawaUrl);

    const response = await fetch(dawaUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': '944-Trafik-App/1.0'
      }
    });

    if (!response.ok) {
      console.error("DAWA API error:", response.status, response.statusText);
      // Fallback to hardcoded addresses if DAWA fails
      return getFallbackAddresses(q, limit);
    }

    const data = await response.json();
    console.log("DAWA response:", data);

    // Normalize DAWA response to our format
    const suggestions = (data||[]).map((item:any)=>{
      return {
        id: item.adresse?.id || item.id || null,
        text: item.tekst || item.adresse?.betegnelse || '',
        postcode: item.adresse?.postnr || null,
        city: item.adresse?.postnrnavn || null,
        lon: item.adresse?.x || null,
        lat: item.adresse?.y || null
      };
    }).filter((s:any)=> s.text && s.postcode && s.city);

    console.log("Normalized suggestions:", suggestions);
    return NextResponse.json({ ok:true, suggestions });
  }catch(e:any){
    console.error("Addresses API error:", e);
    // Fallback to hardcoded addresses if DAWA fails
    const url = new URL(req.url);
    const q = (url.searchParams.get('q')||'').trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit')||'8')));
    return getFallbackAddresses(q, limit);
  }
}

// Fallback function with hardcoded addresses
function getFallbackAddresses(q: string, limit: number) {
  console.log("Using fallback addresses for query:", q);

  const danishAddresses = [
    { navn: 'Københavns Lufthavn (CPH)', x: 12.6500, y: 55.6180, postnummer: { nr: '2791', navn: 'Dragør' } },
    { navn: 'Københavns Hovedbanegård', x: 12.5655, y: 55.6729, postnummer: { nr: '1570', navn: 'København V' } },
    { navn: 'Frederikssund Station', x: 12.0686, y: 55.8396, postnummer: { nr: '3600', navn: 'Frederikssund' } },
    { navn: 'Maglehøjparken 137', x: 12.0686, y: 55.8396, postnummer: { nr: '3600', navn: 'Frederikssund' } },
    { navn: 'Lufthavnsboulevarden 6', x: 12.6500, y: 55.6180, postnummer: { nr: '2770', navn: 'Kastrup' } },
    { navn: 'Aarhus Hovedbanegård', x: 10.2108, y: 56.1496, postnummer: { nr: '8000', navn: 'Aarhus C' } },
    { navn: 'Odense Banegård', x: 10.4024, y: 55.4038, postnummer: { nr: '5000', navn: 'Odense C' } }
  ];

  const filteredPlaces = danishAddresses.filter((place: any) =>
    place.navn.toLowerCase().includes(q.toLowerCase()) ||
    place.postnummer.navn.toLowerCase().includes(q.toLowerCase()) ||
    place.postnummer.nr.includes(q)
  );

  const suggestions = filteredPlaces.slice(0, limit).map((place: any) => ({
    id: null,
    text: place.navn,
    postcode: place.postnummer.nr,
    city: place.postnummer.navn,
    lon: place.x,
    lat: place.y
  }));

  return NextResponse.json({ ok:true, suggestions });
}
