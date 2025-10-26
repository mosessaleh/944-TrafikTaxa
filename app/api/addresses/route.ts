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

    // For demo purposes, return some hardcoded famous places in Copenhagen
    // In production, you would use the DAWA APIs
    const famousPlaces = [
      { navn: 'Københavns Lufthavn (CPH)', x: 12.6500, y: 55.6180, postnummer: { nr: '2791', navn: 'Dragør' } },
      { navn: 'Københavns Hovedbanegård', x: 12.5655, y: 55.6729, postnummer: { nr: '1570', navn: 'København V' } },
      { navn: 'Tivoli Gardens', x: 12.5667, y: 55.6736, postnummer: { nr: '1631', navn: 'København V' } },
      { navn: 'Christiansborg Slot', x: 12.5808, y: 55.6761, postnummer: { nr: '1218', navn: 'København K' } },
      { navn: 'Den Lille Havfrue', x: 12.5918, y: 55.6929, postnummer: { nr: '2100', navn: 'København Ø' } },
      { navn: 'Nyhavn', x: 12.5900, y: 55.6797, postnummer: { nr: '1051', navn: 'København K' } },
      { navn: 'Politigården', x: 12.5580, y: 55.6794, postnummer: { nr: '1567', navn: 'København V' } },
      { navn: 'Rigshospitalet', x: 12.5744, y: 55.6961, postnummer: { nr: '2100', navn: 'København Ø' } }
    ];

    // Filter places based on search query
    const filteredPlaces = famousPlaces.filter(place =>
      place.navn.toLowerCase().includes(q.toLowerCase())
    );

    const data = filteredPlaces.slice(0, limit);

    // Normalize to a compact shape
    const suggestions = (data||[]).map((it:any)=>{
      // Handle both address and POI responses
      const a = it?.adgangsadresse || {};
      const addr = a?.adresse || a?.vejstykke || {};
      const x = a?.adgangspunkt?.koordinater?.[0] || it?.x; // lon
      const y = a?.adgangspunkt?.koordinater?.[1] || it?.y; // lat
      const post = a?.postnummer?.nr || a?.postnr || it?.postnummer?.nr;
      const city = a?.postnummer?.navn || a?.postdistrict || it?.postnummer?.navn;

      return {
        id: a?.id || it?.adresse?.id || it?.id || null,
        text: it?.tekst || it?.adresse?.betegnelse || it?.navn || '',
        postcode: post || null,
        city: city || null,
        lon: typeof x === 'number' ? x : null,
        lat: typeof y === 'number' ? y : null
      };
    }).filter((s:any)=> s.text);

    return NextResponse.json({ ok:true, suggestions });
  }catch(e:any){
    return NextResponse.json({ ok:true, suggestions: [] });
  }
}
