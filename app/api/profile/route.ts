import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

const Schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(3),
  street: z.string().min(1),
  houseNumber: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1)
});

export async function GET(){
  const me = await getUserFromCookie();
  if(!me) return NextResponse.json({ ok:false, me:null }, { status:200 });
  const safe = await prisma.user.findUnique({ where:{ id: me.id }, select:{ id:true, email:true, emailVerified:true, firstName:true, lastName:true, phone:true, street:true, houseNumber:true, postalCode:true, city:true, role:true } });
  return NextResponse.json({ ok:true, me: safe });
}

export async function PUT(req: Request){
  const me = await getUserFromCookie();
  if(!me) return NextResponse.json({ ok:false }, { status:401 });
  const data = Schema.parse(await req.json());
  const emailChanged = data.email.toLowerCase() !== me.email.toLowerCase();
  const update:any = { firstName:data.firstName, lastName:data.lastName, phone:data.phone, street:data.street, houseNumber:data.houseNumber, postalCode:data.postalCode, city:data.city };
  if(emailChanged){ update.pendingEmail = data.email; update.pendingEmailCode = String(Math.floor(100000+Math.random()*900000)); update.pendingEmailExpires = new Date(Date.now()+1000*60*30); }
  await prisma.user.update({ where:{ id: me.id }, data: update });
  return NextResponse.json({ ok:true, pendingEmail: emailChanged? data.email: null });
}
