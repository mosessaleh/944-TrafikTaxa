import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const me = await getUserFromCookie();

    // Get active payment methods
    const paymentMethods = await (prisma as any).paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });

    // Filter out invoice payment if user doesn't have permission
    const filteredMethods = paymentMethods.filter((method: any) => {
      if (method.key === 'invoice') {
        return (me as any)?.canPayByInvoice === true || (me as any)?.role === 'ADMIN';
      }
      return true;
    });

    return NextResponse.json({
      success: true,
      paymentMethods: filteredMethods
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}