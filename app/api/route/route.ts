import { NextResponse } from 'next/server';

// Route planning API using Google Directions API
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

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLon}&destination=${endLat},${endLon}&mode=driving&key=${apiKey}`;

    try {
      const response = await fetch(directionsUrl, {
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        console.error('Google Directions API error status:', response.status);
        return fallbackResponse(startLat, startLon, endLat, endLon);
      }

      const data = await response.json();

      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.warn('Google Directions: no routes returned, status:', data.status);
        return fallbackResponse(startLat, startLon, endLat, endLon);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      // Convert Google polyline to GeoJSON format
      const geometry = {
        type: 'LineString',
        coordinates: decodePolyline(route.overview_polyline.points).map((point: [number, number]) => [point[1], point[0]]) // [lng, lat]
      };

      return NextResponse.json({
        ok: true,
        route: {
          geometry,
          distance: leg.distance.value, // meters
          duration: leg.duration.value // seconds
        }
      });

    } catch (directionsError) {
      console.error('Google Directions request failed, falling back to straight line:', directionsError);
      return fallbackResponse(startLat, startLon, endLat, endLon);
    }

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

function fallbackResponse(startLat: string, startLon: string, endLat: string, endLon: string) {
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

// Decode Google Maps encoded polyline
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}