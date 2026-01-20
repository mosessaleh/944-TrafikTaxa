import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(){
  const u = await getUserFromCookie();
  if (!u) return NextResponse.json({ ok:false }, { status:401 });
  const { prisma } = await import('@/lib/db');
  const userWithPermission = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, address: true, role: true, canPayByInvoice: true, language: true }
  });
  return NextResponse.json({ ok:true, user: userWithPermission });
}
