import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const UpdatePaymentMethodSchema = z.object({
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});

/**
 * PUT /api/user/payment-methods/[id] - Update payment method
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paymentMethodId = parseInt(params.id);
    if (isNaN(paymentMethodId)) {
      return NextResponse.json({ error: 'Invalid payment method ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = UpdatePaymentMethodSchema.parse(body);

    // Verify ownership
    const existingMethod = await (prisma as any).userPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: user.id
      }
    });

    if (!existingMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults first
    if (validatedData.isDefault) {
      await (prisma as any).userPaymentMethod.updateMany({
        where: {
          userId: user.id,
          id: { not: paymentMethodId }
        },
        data: { isDefault: false }
      });
    }

    const updatedMethod = await (prisma as any).userPaymentMethod.update({
      where: { id: paymentMethodId },
      data: validatedData,
      select: {
        id: true,
        type: true,
        provider: true,
        last4: true,
        expiryMonth: true,
        expiryYear: true,
        isDefault: true,
        isActive: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      paymentMethod: updatedMethod,
      message: 'Payment method updated successfully'
    });

  } catch (error) {
    console.error('Error updating payment method:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/payment-methods/[id] - Delete payment method
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paymentMethodId = parseInt(params.id);
    if (isNaN(paymentMethodId)) {
      return NextResponse.json({ error: 'Invalid payment method ID' }, { status: 400 });
    }

    // Check if payment method is being used by any pending bookings
    const activeBookings = await (prisma as any).ride.count({
      where: {
        userId: user.id,
        savedPaymentMethodId: paymentMethodId,
        status: { in: ['CONFIRMED', 'DISPATCHED', 'ONGOING'] }
      }
    });

    if (activeBookings > 0) {
      return NextResponse.json({
        error: 'Cannot delete payment method that is associated with active bookings'
      }, { status: 400 });
    }

    // Verify ownership and delete
    const deletedMethod = await (prisma as any).userPaymentMethod.deleteMany({
      where: {
        id: paymentMethodId,
        userId: user.id
      }
    });

    if (deletedMethod.count === 0) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting payment method:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}