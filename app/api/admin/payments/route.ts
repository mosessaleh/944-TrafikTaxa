import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const me = await requireAdmin();

    const paymentMethods = await (prisma as any).paymentMethod.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      success: true,
      paymentMethods
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}