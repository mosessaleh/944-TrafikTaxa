import { NextResponse } from 'next/server';

// Route planning API using OpenRouteService (free tier available)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const startLat = url.searchParams.get('startLat');
    const startLon = url.searchParams.get('startLon');
    const endLat = url.searchParams.get('endLat');
    const endLon = url.searchParams.get('endLon');

    if (!startLat || !startLon || !endLat || !endLon) {
      return NextResponse.json({
        ok: false,
        error: 'Missing coordinates'
      }, { status: 400 });
    }

    // Use OpenRouteService Directions API (free tier)
    const orsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${process.env.OPENROUTESERVICE_API_KEY}&start=${startLon},${startLat}&end=${endLon},${endLat}&format=geojson&profile=driving-car`;

    const response = await fetch(orsUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': process.env.OPENROUTESERVICE_API_KEY || ''
      },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error('OpenRouteService error:', response.status);
      // Fallback to simple straight line if routing fails
      return NextResponse.json({
        ok: true,
        route: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [parseFloat(startLon), parseFloat(startLat)],
              [parseFloat(endLon), parseFloat(endLat)]
            ]
          },
          properties: {
            distance: 0,
            duration: 0
          }
        }
      });
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const route = data.features[0];
      return NextResponse.json({
        ok: true,
        route: {
          geometry: route.geometry,
          distance: route.properties?.segments?.[0]?.distance || 0,
          duration: route.properties?.segments?.[0]?.duration || 0
        }
      });
    }

    // Fallback to straight line
    return NextResponse.json({
      ok: true,
      route: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [parseFloat(startLon), parseFloat(startLat)],
            [parseFloat(endLon), parseFloat(endLat)]
          ]
        },
        properties: {
          distance: 0,
          duration: 0
        }
      }
    });

  } catch (error: any) {
    console.error('Route API error:', error);

    if (error.name === 'AbortError') {
      return NextResponse.json({
        ok: false,
        error: 'Route service timeout'
      }, { status: 504 });
    }

    return NextResponse.json({
      ok: false,
      error: 'Route service error'
    }, { status: 500 });
  }
}