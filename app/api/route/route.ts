import { NextResponse } from 'next/server';

// Route planning API using OSRM (Open Source Routing Machine)
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

    // Use public OSRM server (driving-car profile)
    // Docs: http://project-osrm.org/docs/v5.5.1/api/#route-service
    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${encodeURIComponent(startLon)},${encodeURIComponent(startLat)};` +
      `${encodeURIComponent(endLon)},${encodeURIComponent(endLat)}` +
      `?overview=full&geometries=geojson`;

    let useFallback = false;
    let geometry: any = null;
    let distance = 0;
    let duration = 0;

    try {
      const response = await fetch(osrmUrl, {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error('OSRM error status:', response.status);
        useFallback = true;
      } else {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          geometry = route.geometry; // GeoJSON LineString { type, coordinates }
          distance = route.distance || 0;
          duration = route.duration || 0;
        } else {
          console.warn('OSRM: no routes returned, falling back to straight line.');
          useFallback = true;
        }
      }
    } catch (osrmError) {
      console.error('OSRM request failed, falling back to straight line:', osrmError);
      useFallback = true;
    }

    // If OSRM failed or returned no geometry, fall back to simple straight line
    if (useFallback || !geometry) {
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
          distance: 0,
          duration: 0
        }
      });
    }

    // Successful OSRM route with real geometry
    return NextResponse.json({
      ok: true,
      route: {
        geometry,
        distance,
        duration
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