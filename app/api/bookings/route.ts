import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { estimateDistanceTime } from '@/lib/distance';
import { computePrice } from '@/lib/price';
import { sendEmail } from '@/lib/email';

const Schema = z.object({
  riderName: z.string().min(1),
  passengers: z.number().int().min(1),
  pickupAddress: z.string().min(3),
  dropoffAddress: z.string().min(3),
  scheduled: z.boolean(),
  pickupTime: z.string()
});

export async function GET(){
  const u = await getUserFromCookie();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  if (!u.emailVerified) return NextResponse.json({ ok:false, error:'EMAIL_NOT_VERIFIED' }, { status:403 });
  const rides = await prisma.ride.findMany({ where:{ userId:u.id }, orderBy:{ createdAt:'desc' } });
  return NextResponse.json({ ok:true, rides });
}

export async function POST(req: Request){
  try{
    const u = await getUserFromCookie();
    if (!u) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });
    if (!u.emailVerified) return NextResponse.json({ ok:false, error:'EMAIL_NOT_VERIFIED' }, { status:403 });

    const data = Schema.parse(await req.json());
    if (data.passengers > 4){
      return NextResponse.json({ ok:false, needTwoCars:true, message:'More than 4 passengers: please book two cars or cancel.' }, { status:400 });
    }

    const { distanceKm, durationMin } = await estimateDistanceTime(data.pickupAddress, data.dropoffAddress);
    const at = new Date(data.pickupTime);
    const price = await computePrice(distanceKm, durationMin, at);

    const ride = await prisma.ride.create({
      data: {
        userId: u.id,
        riderName: data.riderName,
        passengers: data.passengers,
        pickupAddress: data.pickupAddress,
        dropoffAddress: data.dropoffAddress,
        scheduled: data.scheduled,
        pickupTime: at,
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMin,
        price
      }
    });

    const admin = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (admin) {
      const title = data.scheduled ? 'Scheduled booking' : 'Immediate booking';
      await sendEmail(admin, `${title} #${ride.id}`, `<p>New booking from ${u.firstName} ${u.lastName}.<br/>Pickup: ${ride.pickupAddress}<br/>Dropoff: ${ride.dropoffAddress}<br/>Time: ${ride.pickupTime.toISOString()}<br/>Price: ${ride.price}</p>`);
    }

    return NextResponse.json({ ok:true, ride });
  }catch(e:any){
    return NextResponse.json({ ok:false, error:e.message||'Invalid' }, { status:400 });
  }
}
