import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const paymentMethods = await (prisma as any).paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        isActive: true
      }
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