import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const drivers = await prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(drivers);
}
