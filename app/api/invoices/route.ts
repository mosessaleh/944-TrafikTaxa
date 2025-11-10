import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const me = await getUserFromCookie();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use raw SQL query to work with existing invoice table
    const invoices = await prisma.$queryRaw`
      SELECT
        i.*,
        r.price as ride_price
      FROM invoice i
      LEFT JOIN ride r ON i.rideId = r.id
      WHERE i.userId = ${me.id} AND i.status = 1
      ORDER BY i.createdAt DESC
    `;

    return NextResponse.json({ ok: true, invoices });
  } catch (error) {
    console.error('Error fetching user invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}