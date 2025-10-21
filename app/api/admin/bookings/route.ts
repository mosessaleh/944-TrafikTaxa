import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(){
  const rides = await prisma.ride.findMany({ orderBy:{ createdAt:'desc' }, include:{ user:true } })
  return NextResponse.json({ ok:true, rides })
}
