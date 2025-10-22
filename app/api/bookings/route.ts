import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';

const Schema = z.object({
  riderName: z.string().min(1),
  pickupAddress: z.string().min(1),
  dropoffAddress: z.string().min(1),
  pickupLat: z.number().optional().nullable(),
  pickupLon: z.number().optional().nullable(),
  dropoffLat: z.number().optional().nullable(),
  dropoffLon: z.number().optional().nullable(),
  vehicleTypeId: z.number().int(),
  scheduled: z.boolean(),
  pickupTime: z.string()
});

export async function GET(){
  const u = await getUserFromCookie();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  if (!u.emailVerified) return NextResponse.json({ ok:false, error:'Email not verified' }, { status:403 });
  const rides = await prisma.ride.findMany({ where:{ userId:u.id }, orderBy:{ createdAt:'desc' } });
  return NextResponse.json({ ok:true, rides });
}

export async function POST(req: Request){
  try{ await limitOrThrow('book:'+clientIpKey(req), { points: 5, durationSec: 60 }); }
  catch(e:any){ return NextResponse.json({ ok:false, error:'Too many requests, try again later.' }, { status: e?.status||429 }); }

  try{
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });
    if (!u.emailVerified) return NextResponse.json({ ok:false, error:'Email not verified' }, { status:403 });

    const data = Schema.parse(await req.json());

    // Ensure vehicle type is active
    const vt = await prisma.vehicleType.findUnique({ where:{ id: data.vehicleTypeId }, select:{ id:true, active:true } });
    if (!vt || !vt.active) return NextResponse.json({ ok:false, error:'Vehicle type not available' }, { status:400 });

    const { distanceKm, durationMin } = await safeEstimateDistance(
      { address: data.pickupAddress, lat: data.pickupLat||null, lon: data.pickupLon||null },
      { address: data.dropoffAddress, lat: data.dropoffLat||null, lon: data.dropoffLon||null }
    );
    const at = new Date(data.pickupTime);
    const price = await computePrice(distanceKm, durationMin, at, data.vehicleTypeId);

    const ride = await prisma.ride.create({
      data: {
        userId: u.id,
        riderName: data.riderName,
        passengers: 1,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        scheduled: data.scheduled,
        pickupTime: at,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin,
        price,
        vehicleTypeId: data.vehicleTypeId
      }
    });

    const admin = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (admin) {
      const title = data.scheduled ? 'Scheduled booking' : 'Immediate booking';
      import('@/lib/email').then(({ sendEmail })=> sendEmail(admin, `${title} #${ride.id}`, `<p>New booking: Vehicle type ${data.vehicleTypeId}.<br/>Pickup: ${ride.pickupAddress}<br/>Dropoff: ${ride.dropoffAddress}<br/>Time: ${ride.pickupTime.toISOString()}<br/>Price: ${ride.price}</p>`)).catch(()=>{});
    }

    return NextResponse.json({ ok:true, ride });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:'Could not place booking. Please refine addresses and try again.' }, { status:400 });
  }
}
