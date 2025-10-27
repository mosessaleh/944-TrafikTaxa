import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { safeEstimateDistance } from '@/lib/geocode-safe';
import { computePrice } from '@/lib/price';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';
import { sanitizeInput } from '@/lib/sanitize';

const Schema = z.object({
  riderName: z.string()
    .min(2, "Rider name must be at least 2 characters")
    .max(100, "Rider name is too long")
    .regex(/^[a-zA-Z\s\-'\.]+$/, "Rider name contains invalid characters"),
  pickupAddress: z.string()
    .min(3, "Pickup address must be at least 3 characters")
    .max(500, "Pickup address is too long")
    .regex(/^[a-zA-Z0-9\s,.\-#&()\/]+$/, "Pickup address contains invalid characters"),
  dropoffAddress: z.string()
    .min(3, "Dropoff address must be at least 3 characters")
    .max(500, "Dropoff address is too long")
    .regex(/^[a-zA-Z0-9\s,.\-#&()\/]+$/, "Dropoff address contains invalid characters"),
  pickupLat: z.number().min(-90).max(90).optional().nullable(),
  pickupLon: z.number().min(-180).max(180).optional().nullable(),
  dropoffLat: z.number().min(-90).max(90).optional().nullable(),
  dropoffLon: z.number().min(-180).max(180).optional().nullable(),
  vehicleTypeId: z.number().int().positive("Invalid vehicle type"),
  scheduled: z.boolean(),
  pickupTime: z.string().refine(val => {
    const date = new Date(val);
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setDate(now.getDate() + 90);
    return date > now && date <= maxFuture;
  }, "Pickup time must be in the future but within 90 days"),
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

    const rawData = await req.json();

    // Sanitize inputs before validation
    const sanitizedData = {
      riderName: sanitizeInput(rawData.riderName, 'text'),
      pickupAddress: sanitizeInput(rawData.pickupAddress, 'address'),
      dropoffAddress: sanitizeInput(rawData.dropoffAddress, 'address'),
      pickupLat: sanitizeInput(rawData.pickupLat, 'number'),
      pickupLon: sanitizeInput(rawData.pickupLon, 'number'),
      dropoffLat: sanitizeInput(rawData.dropoffLat, 'number'),
      dropoffLon: sanitizeInput(rawData.dropoffLon, 'number'),
      vehicleTypeId: sanitizeInput(rawData.vehicleTypeId, 'number'),
      scheduled: sanitizeInput(rawData.scheduled, 'boolean'),
      pickupTime: rawData.pickupTime // Keep as string for date validation
    };

    const data = Schema.parse(sanitizedData);

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
