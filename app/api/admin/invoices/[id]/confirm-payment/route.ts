import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

// =====================
// Simple Rate Limiting System
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      await createAuditLog(
        'admin_unauthorized_access_attempt',
        'unknown',
        {
          action: 'confirm_payment',
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

    // =====================
    // Rate Limiting Check
    // =====================
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `admin:${clientIp}:confirm-payment`;
    const rateLimitResult = await rateLimiter.checkLimit(rateLimitKey, 5, 5 * 60 * 1000); // 5 requests per 5 minutes

    if (!rateLimitResult.success) {
      await createAuditLog(
        'admin_rate_limit_exceeded',
        me.id.toString(),
        {
          action: 'confirm_payment',
          invoiceId,
          reason: 'rate_limit_exceeded',
          severity: 'medium'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '300' // 5 minutes
          }
        }
      );
    }

    // =====================
    // Transaction Safety with Enhanced Validation and Receipt Generation
    // =====================
    let updatedInvoice;
    try {
      updatedInvoice = await prisma.$transaction(async (tx) => {
        // Enhanced validation: Check if invoice exists and is valid
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            user: true,
            ride: {
              include: {
                vehicleType: true
              }
            }
          }
        });

        if (!invoice) {
          throw new Error('Invoice not found');
        }

        if (invoice.paymentStatus === 'PAID') {
          throw new Error('Invoice already paid');
        }

        if (invoice.status !== 1) {
          throw new Error('Invoice is not active');
        }

        // Generate unique receipt number
        const receiptNumber = `RCP-${invoice.invoiceNumber}-${Date.now()}`;
        
        // Generate payment reference
        const paymentRef = `ADM-${me.id}-${Date.now()}`;

        // Calculate payment amount (convert from DKK to proper format if needed)
        const paymentAmount = invoice.ride?.price ? invoice.ride.price / 100 : 0;

        // Update invoice with payment receipt information
        const updatedInvoice = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paymentStatus: 'PAID',
            updatedAt: new Date(),
            // Use type assertion for new fields that Prisma client doesn't know yet
            ...(true && {
              paymentMethod: 'admin_confirmed',
              paymentRef: paymentRef,
              paymentDate: new Date(),
              paymentAmount: paymentAmount,
              paymentNotes: `Payment manually confirmed by admin ${me.firstName} ${me.lastName} (ID: ${me.id})`,
              confirmedBy: me.id,
              confirmedAt: new Date(),
              receiptNumber: receiptNumber,
            })
          } as any,
          include: {
            user: true,
            ride: {
              include: {
                vehicleType: true
              }
            },
          },
        });

        // Update ride payment status to PAID
        await tx.ride.update({
          where: { id: invoice.rideId },
          data: {
            paymentStatus: 'PAID',
            explanation: `Payment confirmed by admin - Receipt: ${receiptNumber}`,
            status: 'CONFIRMED',
            paymentMethod: 'admin_confirmed'
          },
        });

        return updatedInvoice;
      });

    } catch (transactionError) {
      await createAuditLog(
        'admin_confirm_payment_failed',
        me.id.toString(),
        {
          action: 'confirm_payment',
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
    // Successful Audit Logging
    // =====================
    await createAuditLog(
      'admin_confirm_payment_success',
      me.id.toString(),
      {
        action: 'confirm_payment',
        invoiceId,
        invoiceNumber: (updatedInvoice as any).invoiceNumber,
        amount: (updatedInvoice as any).ride?.price || 0,
        userId: (updatedInvoice as any).userId,
        userEmail: (updatedInvoice as any).user?.email,
        receiptNumber: (updatedInvoice as any).receiptNumber,
        paymentRef: (updatedInvoice as any).paymentRef,
        severity: 'high'
      },
      clientIp,
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Payment confirmed successfully',
      remainingRequests: rateLimitResult.remaining
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('not found') ? 404 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}