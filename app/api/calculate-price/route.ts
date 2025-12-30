import { NextRequest, NextResponse } from 'next/server';
import { computePrice } from '@/lib/price';
import { getDistanceAndDuration } from '@/lib/distance';

interface CalculatePriceRequest {
  pickupLat: number;
  pickupLon: number;
  dropoffLat: number;
  dropoffLon: number;
  vehicleTypeId: number;
  pickupTime?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CalculatePriceRequest = await request.json();
    const { pickupLat, pickupLon, dropoffLat, dropoffLon, vehicleTypeId, pickupTime } = body;

    if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon || !vehicleTypeId) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required parameters: pickupLat, pickupLon, dropoffLat, dropoffLon, vehicleTypeId'
      }, { status: 400 });
    }

    // Get precise distance and duration using Google Distance Matrix
    const googleResults = await getDistanceAndDuration(
      [{ lat: pickupLat, lng: pickupLon }],
      [{ lat: dropoffLat, lng: dropoffLon }]
    );

    if (!googleResults || googleResults.length === 0 || !googleResults[0]) {
      return NextResponse.json({
        ok: false,
        error: 'Unable to calculate route distance and duration'
      }, { status: 400 });
    }

    const distanceKm = googleResults[0].distance;
    const durationMin = googleResults[0].duration;

    // Calculate price using the pricing algorithm
    const pickupDateTime = pickupTime ? new Date(pickupTime) : new Date();
    const estimatedPrice = await computePrice(distanceKm, durationMin, pickupDateTime, vehicleTypeId);

    return NextResponse.json({
      ok: true,
      price: estimatedPrice,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMin: Math.round(durationMin),
      currency: 'DKK'
    });

  } catch (error) {
    console.error('Error calculating price:', error);
    return NextResponse.json({
      ok: false,
      error: 'Internal server error during price calculation'
    }, { status: 500 });
  }
}