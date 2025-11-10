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

    // Try Photon API first (faster OpenStreetMap-based geocoding)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`;

      const response = await fetch(photonUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': '944-Trafik-App/1.0'
        },
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });

      if (response.ok) {
        const data = await response.json();

        // Transform Photon response to our format
        const suggestions = (data.features || []).map((item: any) => {
          const properties = item.properties || {};
          const name = properties.name || '';
          const street = properties.street || '';
          const housenumber = properties.housenumber || '';
          const city = properties.city || properties.town || properties.village || properties.municipality || '';
          const postcode = properties.postcode || '';
          const country = properties.country || '';

          // Build clean address text
          let text = '';
          if (street) {
            text += street;
            if (housenumber) text += ' ' + housenumber;
          } else if (name) {
            text += name;
          }

          if (city && country === 'Denmark') {
            text += ', ' + city;
            if (postcode) text += ' ' + postcode;
          }

          return {
            id: item.properties?.osm_id?.toString() || null,
            text: text || properties.name || '',
            postcode: postcode,
            city: city,
            lon: item.geometry?.coordinates?.[0] || null,
            lat: item.geometry?.coordinates?.[1] || null
          };
        }).filter((s: any) => s.text && s.city && s.city); // Only show addresses with city in Denmark

        if (suggestions.length > 0) {
          return NextResponse.json({ ok: true, suggestions });
        }
      }
    } catch (photonError) {
      console.warn('Photon API failed:', photonError);
    }

    // Fallback to Nominatim if Photon fails
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?countrycodes=DK&q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': '944-Trafik-App/1.0'
        },
        signal: AbortSignal.timeout(1000) // 1 second timeout
      });

      if (response.ok) {
        const data = await response.json();

        // Transform Nominatim response to our format
        const suggestions = (data || []).map((item: any) => {
          const address = item.address || {};
          const houseNumber = address.house_number || '';
          const road = address.road || address.pedestrian || address.path || '';
          const postcode = address.postcode || '';
          const city = address.city || address.town || address.village || address.municipality || '';

          // Build clean address text: "Street Name HouseNumber, Postcode City"
          let text = '';
          if (road) {
            text += road;
            if (houseNumber) text += ' ' + houseNumber;
          }
          if (postcode || city) {
            text += ', ' + [postcode, city].filter(Boolean).join(' ');
          }

          return {
            id: item.place_id?.toString() || null,
            text: text || item.display_name || '',
            postcode: postcode,
            city: city,
            lon: item.lon ? parseFloat(item.lon) : null,
            lat: item.lat ? parseFloat(item.lat) : null
          };
        }).filter((s: any) => s.text);

        return NextResponse.json({ ok: true, suggestions });
      }
    } catch (nominatimError) {
      console.warn('Nominatim API also failed:', nominatimError);
    }

    // If both APIs fail, return empty suggestions (don't block booking)
    return NextResponse.json({ ok: true, suggestions: [] });

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
