import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = parseInt(params.id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    // Update invoice status to cancelled
    const invoice = await (prisma as any).invoice.update({
      where: { id: invoiceId },
      data: {
        status: 0, // Cancelled
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}