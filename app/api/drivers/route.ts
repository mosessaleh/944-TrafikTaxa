import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  // Note: No driver model in schema, returning empty array
  return NextResponse.json([]);
}
