import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await requireAdmin();

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
    console.log(`Toggling payment method ${paymentMethodId} from ${paymentMethod.isActive} to ${!paymentMethod.isActive}`);
    const updatedMethod = await (prisma as any).paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isActive: !paymentMethod.isActive }
    });
    console.log('Payment method updated successfully:', updatedMethod);

    // Redirect back to admin payments page
    return NextResponse.redirect(new URL('/admin/payments', request.url));

  } catch (error: any) {
    console.error('Error toggling payment method:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}