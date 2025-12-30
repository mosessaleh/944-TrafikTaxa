import { NextResponse } from 'next/server';

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

    // Use Google Places API for address autocomplete
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const placesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:dk&key=${apiKey}&language=da`;

    try {
      const response = await fetch(placesUrl, {
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        console.warn('Google Places API error:', response.status);
        return NextResponse.json({ ok: true, suggestions: [] });
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.predictions) {
        console.warn('Google Places API returned status:', data.status);
        return NextResponse.json({ ok: true, suggestions: [] });
      }

      // Get place details for the top predictions to get coordinates
      const suggestions = await Promise.all(
        data.predictions.slice(0, limit).map(async (prediction: any) => {
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=formatted_address,geometry,address_components&key=${apiKey}&language=da`;

            const detailsResponse = await fetch(detailsUrl, {
              signal: AbortSignal.timeout(2000)
            });

            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();

              if (detailsData.status === 'OK' && detailsData.result) {
                const result = detailsData.result;
                const location = result.geometry?.location;

                // Extract postcode and city
                let postcode = null;
                let city = null;
                if (result.address_components) {
                  for (const component of result.address_components) {
                    if (component.types.includes('postal_code')) {
                      postcode = component.long_name;
                    }
                    if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                      city = component.long_name;
                    }
                  }
                }

                return {
                  id: prediction.place_id,
                  text: result.formatted_address,
                  postcode,
                  city,
                  lat: location?.lat || null,
                  lon: location?.lng || null
                };
              }
            }
          } catch (detailsError) {
            console.warn('Failed to get place details for', prediction.place_id, detailsError);
          }

          // Fallback without coordinates
          return {
            id: prediction.place_id,
            text: prediction.description,
            postcode: null,
            city: null,
            lat: null,
            lon: null
          };
        })
      );

      // Remove duplicates based on place_id
      const uniqueSuggestions = suggestions.filter((s, index, arr) =>
        arr.findIndex(other => other.id === s.id) === index
      );
      const filteredSuggestions = uniqueSuggestions.filter(s => s.text && /^[\w\s,.\-()&éÉüÜöÖäÄßæøåÆØÅ]+$/.test(s.text));
      return NextResponse.json({ ok: true, suggestions: filteredSuggestions });

    } catch (placesError) {
      console.warn('Google Places API failed:', placesError);
      return NextResponse.json({ ok: true, suggestions: [] });
    }

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
