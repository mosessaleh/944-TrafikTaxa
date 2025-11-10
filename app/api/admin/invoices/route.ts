import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoices = await (prisma as any).invoice.findMany({
      where: {
        paymentStatus: 'UNPAID',
        status: 1, // Only active invoices
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        ride: {
          include: {
            vehicleType: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}