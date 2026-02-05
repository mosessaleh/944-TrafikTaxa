import { NextResponse } from 'next/server';
import { z } from 'zod';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePriceWithDetails } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';

const Schema = z.object({
  pickupAddress: z.string().min(1),
  dropoffAddress: z.string().min(1),
  stopAddress: z.string().trim().min(1).optional().nullable(),
  when: z.string().min(1),
  passengers: z.union([z.number().int(), z.string()]).optional(),
  pickupLat: z.number().optional().nullable(),
  pickupLon: z.number().optional().nullable(),
  stopLat: z.number().optional().nullable(),
  stopLon: z.number().optional().nullable(),
  dropoffLat: z.number().optional().nullable(),
  dropoffLon: z.number().optional().nullable(),
  vehicleTypeId: z.number().int().optional()
});

export async function POST(req: Request){
  try{ await limitOrThrow('quote:'+clientIpKey(req), { points: 8, durationSec: 60 }); }
  catch(e:any){ return NextResponse.json({ ok:false, error:'Too many requests, try again later.' }, { status: e?.status||429 }); }

  try{
    const parsed = Schema.parse(await req.json());
    const hasStop = Boolean(parsed.stopAddress);
    let distanceKm = 0;
    let durationMin = 0;

    if (hasStop) {
      const firstLeg = await safeEstimateDistance(
        { address: parsed.pickupAddress, lat: parsed.pickupLat || null, lon: parsed.pickupLon || null },
        { address: parsed.stopAddress as string, lat: parsed.stopLat || null, lon: parsed.stopLon || null }
      );
      const secondLeg = await safeEstimateDistance(
        { address: parsed.stopAddress as string, lat: parsed.stopLat || null, lon: parsed.stopLon || null },
        { address: parsed.dropoffAddress, lat: parsed.dropoffLat || null, lon: parsed.dropoffLon || null }
      );
      distanceKm = firstLeg.distanceKm + secondLeg.distanceKm;
      durationMin = firstLeg.durationMin + secondLeg.durationMin;
    } else {
      const result = await safeEstimateDistance(
        { address: parsed.pickupAddress, lat: parsed.pickupLat || null, lon: parsed.pickupLon || null },
        { address: parsed.dropoffAddress, lat: parsed.dropoffLat || null, lon: parsed.dropoffLon || null }
      );
      distanceKm = result.distanceKm;
      durationMin = result.durationMin;
    }
    const at = new Date(parsed.when);
    const priceDetails = await computePriceWithDetails(distanceKm, durationMin, at, parsed.vehicleTypeId);
    return NextResponse.json({
      ok: true,
      distanceKm,
      durationMin,
      price: priceDetails.finalPrice,
      originalPrice: priceDetails.originalPrice,
      discountAmount: priceDetails.discountAmount
    });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Invalid request or addresses could not be geocoded.' }, { status:400 });
  }
}
