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

    // DAWA autocomplete endpoint (returns minimal, fast suggestions)
    const dawaUrl = new URL('https://api.dataforsyningen.dk/adresser/autocomplete');
    dawaUrl.searchParams.set('q', q);
    dawaUrl.searchParams.set('per_side', String(limit));

    const r = await fetch(dawaUrl.toString(), { headers: { 'Accept':'application/json' }, next: { revalidate: 0 } });
    if (!r.ok) return NextResponse.json({ ok:true, suggestions: [] });
    const data: any[] = await r.json();

    // Normalize to a compact shape
    const suggestions = (data||[]).map((it:any)=>{
      const a = it?.adgangsadresse || {};
      const addr = a?.adresse || a?.vejstykke || {};
      const x = a?.adgangspunkt?.koordinater?.[0]; // lon
      const y = a?.adgangspunkt?.koordinater?.[1]; // lat
      const post = a?.postnummer?.nr || a?.postnr;
      const city = a?.postnummer?.navn || a?.postdistrict;
      return {
        id: a?.id || it?.adresse?.id || it?.id || null,
        text: it?.tekst || it?.adresse?.betegnelse || '',
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
