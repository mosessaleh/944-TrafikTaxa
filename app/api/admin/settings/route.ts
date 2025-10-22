import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const Schema = z.object({
  brandName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(3),
  addressCity: z.string().min(1),
  dayBase: z.number().positive(),
  dayPerKm: z.number().positive(),
  dayPerMin: z.number().positive(),
  nightBase: z.number().positive(),
  nightPerKm: z.number().positive(),
  nightPerMin: z.number().positive(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/)
});

export async function GET(){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      brandName: process.env.BRAND_NAME || '944 Trafik',
      contactEmail: process.env.CONTACT_EMAIL || 'trafik@944.dk',
      contactPhone: process.env.CONTACT_PHONE || '26444944',
      addressCity: process.env.ADDRESS_CITY || 'Frederikssund',
      dayBase: 40, dayPerKm: 12.75, dayPerMin: 5.75,
      nightBase: 60, nightPerKm: 16, nightPerMin: 7,
      workStart: '06:00', workEnd: '18:00'
    }
  });
  return NextResponse.json({ ok:true, settings: s });
}

export async function POST(req: Request){
  try{ await requireAdmin(); }catch{ return NextResponse.json({ ok:false }, { status:403 }); }
  const body = Schema.parse(await req.json());
  const s = await prisma.settings.upsert({
    where: { id: 1 },
    update: body,
    create: body
  });
  return NextResponse.json({ ok:true, settings: s });
}
