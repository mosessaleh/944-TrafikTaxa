import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

// =====================
// Simple Rate Limiting System (reusing from other routes)
// =====================
class SimpleRateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  async checkLimit(identifier: string, limit: number, windowMs: number) {
    const now = Date.now();
    const record = this.requests.get(identifier);
    
    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + windowMs });
      return { success: true, remaining: limit - 1 };
    }
    
    if (record.count >= limit) {
      return { success: false, remaining: 0, resetTime: record.resetTime };
    }
    
    record.count++;
    return { success: true, remaining: limit - record.count };
  }
}

const rateLimiter = new SimpleRateLimiter();

// =====================
// Enhanced Audit Logging
// =====================
async function createAuditLog(event: string, userId: string, metadata: any, ipAddress?: string, userAgent?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        event,
        userId,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        metadata: JSON.stringify(metadata),
        severity: metadata.severity || 'medium',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

// =====================
// Enhanced Cancel Invoice with Security Improvements
// =====================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let me;
    try {
      me = await requirePermission('invoices.manage');
    } catch {
      await createAuditLog(
        'admin_unauthorized_cancel_attempt',
        'unknown',
        {
          action: 'cancel_invoice',
          reason: 'unauthorized_access',
          severity: 'high'
        },
        request.headers.get('x-forwarded-for') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = parseInt(params.id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    // =====================
    // Rate Limiting Check for Cancel Operations
    // =====================
    const rateLimitKey = `admin:${clientIp}:cancel-invoice`;
    const rateLimitResult = await rateLimiter.checkLimit(rateLimitKey, 3, 10 * 60 * 1000); // 3 cancels per 10 minutes

    if (!rateLimitResult.success) {
      await createAuditLog(
        'admin_cancel_rate_limit_exceeded',
        me.id.toString(),
        {
          action: 'cancel_invoice',
          invoiceId,
          reason: 'rate_limit_exceeded',
          severity: 'medium'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      
      return NextResponse.json(
        { error: 'Too many cancel attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '600' // 10 minutes
          }
        }
      );
    }

    // =====================
    // Enhanced Validation and Transaction Safety
    // =====================
    let cancelledInvoice;
    try {
      cancelledInvoice = await prisma.$transaction(async (tx) => {
        // Enhanced validation: Check if invoice exists and can be cancelled
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            user: true,
            ride: true
          }
        });

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        if (invoice.status === 0) {
          throw new Error('Invoice is already cancelled');
        }

        if (invoice.paymentStatus === 'PAID') {
          throw new Error('Cannot cancel a paid invoice');
        }

        // Update invoice status to cancelled
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 0, // Cancelled
            updatedAt: new Date()
          },
          include: {
            user: true,
            ride: true,
          },
        });

        // Also update the related ride status
        await tx.ride.update({
          where: { id: invoice.rideId },
          data: {
            status: 'CANCELED',
            explanation: 'Invoice cancelled by admin',
            paymentStatus: 'CANCELED'
          },
        });

        return updatedInvoice;
      });

    } catch (transactionError) {
      await createAuditLog(
        'admin_cancel_invoice_failed',
        me.id.toString(),
        {
          action: 'cancel_invoice',
          invoiceId,
          error: transactionError instanceof Error ? transactionError.message : 'Transaction failed',
          severity: 'high'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      throw transactionError;
    }

    // =====================
    // Successful Cancel Audit Logging
    // =====================
    await createAuditLog(
      'admin_cancel_invoice_success',
      me.id.toString(),
      {
        action: 'cancel_invoice',
        invoiceId,
        invoiceNumber: cancelledInvoice.invoiceNumber,
        amount: cancelledInvoice.ride?.price || 0,
        userId: cancelledInvoice.userId,
        userEmail: cancelledInvoice.user?.email,
        reason: 'admin_cancelled',
        severity: 'high'
      },
      clientIp,
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      invoice: cancelledInvoice,
      message: 'Invoice cancelled successfully',
      remainingRequests: rateLimitResult.remaining
    });

  } catch (error) {
    console.error('Error cancelling invoice:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('not found') ? 404 :
                   errorMessage.includes('already') ? 400 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}
