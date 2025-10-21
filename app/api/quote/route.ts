import { NextResponse } from 'next/server';
import { z } from 'zod';
import { estimateDistanceTime } from '@/lib/distance';
import { computePrice } from '@/lib/price';

const Schema = z.object({
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  dropoffAddress: z.string().min(3, 'Dropoff address is required'),
  when: z.string().min(1, 'When is required'),
  passengers: z.number().int().min(1, 'Passengers must be at least 1')
});

export async function POST(req: Request){
  try{
    const raw = await req.json();
    if (typeof raw?.passengers === 'string') raw.passengers = Number(raw.passengers);
    const data = Schema.parse(raw);

    if (data.passengers > 4){
      return NextResponse.json({ ok:false, needTwoCars:true, error:'More than 4 passengers: please book two cars or reduce passengers.' }, { status:400 });
    }

    try {
      const { distanceKm, durationMin } = await estimateDistanceTime(data.pickupAddress, data.dropoffAddress);
      const at = new Date(data.when);
      const price = await computePrice(distanceKm, durationMin, at);
      return NextResponse.json({ ok:true, distanceKm, durationMin, price });
    } catch (e:any) {
      const msg = e?.message || 'Failed to estimate distance';
      console.error('[quote] distance error:', msg);
      let hint = '';
      if (/Unable to geocode pickup or dropoff/i.test(msg)) hint = 'Could not geocode either pickup or dropoff address. Try entering coordinates like "55.676,12.568" or a more precise address.';
      if (/Insufficient location data/i.test(msg)) hint = 'One of the addresses could not be located. Please refine both addresses or use coordinates.';
      return NextResponse.json({ ok:false, error: hint || msg }, { status:400 });
    }
  }catch(e:any){
    if (e?.issues){
      const details = Object.fromEntries(e.issues.map((i:any)=> [i.path?.[0]||'field', i.message] ));
      return NextResponse.json({ ok:false, error:'Validation failed', details }, { status:400 });
    }
    return NextResponse.json({ ok:false, error: e?.message || 'Bad request' }, { status:400 });
  }
}
