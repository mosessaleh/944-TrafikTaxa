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

    const paymentMethodId = parseInt(params.id);
    if (isNaN(paymentMethodId)) {
      return NextResponse.json({ error: 'Invalid payment method ID' }, { status: 400 });
    }

    // Get current payment method
    const paymentMethod = await (prisma as any).paymentMethod.findUnique({
      where: { id: paymentMethodId }
    });

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Toggle active status
    const updatedMethod = await (prisma as any).paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isActive: !paymentMethod.isActive }
    });

    return NextResponse.json({
      success: true,
      paymentMethod: updatedMethod
    });

  } catch (error) {
    console.error('Error toggling payment method:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}