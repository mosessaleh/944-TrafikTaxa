import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const defaults = [
  { key:'SEDAN5', title:'5-seater car', capacity:5, multiplier:1.00, active:true },
  { key:'SEVEN_NO_BAG', title:'7-seater (no luggage)', capacity:7, multiplier:1.20, active:true },
  { key:'VAN', title:'Van', capacity:8, multiplier:1.50, active:true },
  { key:'LIMO', title:'Luxe limousine', capacity:4, multiplier:2.00, active:true }
] as const;

export async function POST(req: Request){
  try{
    const { token } = await req.json();
    if (!token || token !== process.env.ADMIN_TOKEN) return NextResponse.json({ ok:false }, { status:403 });
    for (const d of defaults){
      await prisma.vehicleType.upsert({
        where: { key: d.key as any },
        update: { title:d.title, capacity:d.capacity, multiplier: d.multiplier, active:d.active },
        create: { key: d.key as any, title:d.title, capacity:d.capacity, multiplier: d.multiplier, active:d.active }
      });
    }
    return NextResponse.json({ ok:true });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: e?.message||'seed failed' }, { status:500 });
  }
}
