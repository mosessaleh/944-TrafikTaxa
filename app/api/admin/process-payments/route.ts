import { NextRequest, NextResponse } from 'next/server';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processCompletedTripPayments, retryFailedPayments } from '@/lib/payment-processor';

/**
 * POST /api/admin/process-payments - Manually trigger payment processing
 * This can be called by cron jobs or admin interface
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const user = await getUserFromCookie();
    if (!user || user.type !== 'user' || (user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action = 'process' } = await request.json().catch(() => ({}));

    let results;

    if (action === 'retry') {
      // Retry failed payments
      results = await retryFailedPayments();
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
    // Check admin authentication
    const user = await getUserFromCookie();
    if (!user || user.type !== 'user' || (user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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