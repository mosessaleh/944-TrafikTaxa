import { NextResponse } from 'next/server';

// DAWA (Danmarks Adressers Web API) integration
// Official Danish address API: https://api.dataforsyningen.dk/adresser

function validateQuery(q: string): boolean {
  if (!q || q.trim().length < 2) return false;
  if (q.length > 100) return false;
  if (/[<>\"'`\\]/.test(q)) return false;
  // Allow Danish characters and basic punctuation
  if (!/^[\w\sæøåÆØÅéÉüÜöÖäÄß\-.,&()]+$/.test(q)) return false;
  return true;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));

    if (!validateQuery(q)) {
      return NextResponse.json({ ok: true, suggestions: [] });
    }

    // DAWA API endpoint for address autocomplete
    const dawaUrl = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(q)}&per_side=${limit}&sortering=adresse`;
    console.log("Fetching from DAWA:", dawaUrl);

    const response = await fetch(dawaUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': '944-Trafik-App/1.0'
      },
      // Add timeout
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error("DAWA API error:", response.status, response.statusText);
      return NextResponse.json({
        ok: false,
        error: 'Address service temporarily unavailable'
      }, { status: 503 });
    }

    const data = await response.json();

    // Transform DAWA response to our format
    const suggestions = (data || []).map((item: any) => ({
      id: item.adresse?.id || item.id || null,
      text: item.tekst || '',
      postcode: item.adresse?.postnr || null,
      city: item.adresse?.postnrnavn || null,
      lon: item.adresse?.x ? parseFloat(item.adresse.x) : null,
      lat: item.adresse?.y ? parseFloat(item.adresse.y) : null
    })).filter((s: any) => s.text && s.postcode && s.city);

    console.log(`Found ${suggestions.length} addresses for query: "${q}"`);
    return NextResponse.json({ ok: true, suggestions });

  } catch (error: any) {
    console.error("Addresses API error:", error);

    if (error.name === 'AbortError') {
      return NextResponse.json({
        ok: false,
        error: 'Address service timeout'
      }, { status: 504 });
    }

    return NextResponse.json({
      ok: false,
      error: 'Address service error'
    }, { status: 500 });
  }
}
