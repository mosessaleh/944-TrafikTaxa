import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processCompletedTripPayments, retryFailedPayments, chargeSavedPaymentMethod } from '@/lib/payment-processor';

/**
 * POST /api/admin/process-payments - Manually trigger payment processing
 * This can be called by cron jobs or admin interface
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('payments.manage');

    const body = await request.json().catch(() => ({}));
    const { action = 'process', rideId } = body;

    let results;

    if (action === 'retry') {
      // Retry failed payments
      results = await retryFailedPayments();
    } else if (action === 'process_single' && rideId) {
      // Process single ride payment
      const ride = await prisma.ride.findUnique({
        where: { id: parseInt(rideId) },
        include: { savedPaymentMethod: true, user: true }
      });

      if (!ride) {
        return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
      }

      // Attach the payment method to the ride object as expected by chargeSavedPaymentMethod
      const rideWithPaymentMethod = {
        ...ride,
        userpaymentmethod: ride.savedPaymentMethod
      };

      if (!ride) {
        return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
      }

      const paymentResult = await chargeSavedPaymentMethod(rideWithPaymentMethod);

      results = {
        processed: 1,
        successful: paymentResult.success ? 1 : 0,
        failed: paymentResult.success ? 0 : 1,
        errors: paymentResult.success ? [] : [paymentResult.error || 'Payment failed'],
        transactionId: paymentResult.transactionId
      };
    } else {
      // Process completed trip payments
      results = await processCompletedTripPayments();
    }

    return NextResponse.json({
      success: true,
      action,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      {
        error: 'Payment processing failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/process-payments - Get payment processing status
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('payments.read');

    // Get statistics about pending payments
    const pendingPayments = await (prisma as any).ride.count({
      where: {
        status: 'COMPLETED',
        paymentStatus: 'PENDING_PAYMENT'
      }
    });

    const failedPayments = await (prisma as any).ride.count({
      where: {
        paymentStatus: 'PAYMENT_FAILED'
      }
    });

    return NextResponse.json({
      success: true,
      stats: {
        pendingPayments,
        failedPayments,
        totalUnpaid: pendingPayments + failedPayments
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error getting payment stats:', error);
    return NextResponse.json(
      { error: 'Failed to get payment statistics' },
      { status: 500 }
    );
  }
}
