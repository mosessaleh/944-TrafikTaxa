import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../lib/db';
import { getUserFromCookie } from '../lib/auth';

// =====================
// Rate Limiting Implementation
// =====================
class RateLimiter {
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

const rateLimiter = new RateLimiter();

// =====================
// Enhanced Audit Logging
// =====================
async function logAuditEvent(event: string, userId: string, metadata: any, ipAddress?: string) {
  try {
    // Store in database using existing AuditLog model
    await prisma.auditLog.create({
      data: {
        event,
        userId,
        ipAddress: ipAddress || 'unknown',
        userAgent: metadata.userAgent || 'unknown',
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
// Transaction Safety
// =====================
async function confirmPaymentTransaction(invoiceId: number, adminId: string, ipAddress: string) {
  return await prisma.$transaction(async (tx: any) => {
    // Check if invoice exists and verify its status
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

    if (invoice.paymentStatus === 'PAID') {
      throw new Error('Invoice already paid');
    }

    if (invoice.status !== 1) {
      throw new Error('Invoice is not active');
    }

    // Update the invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentStatus: 'PAID',
        updatedAt: new Date()
      }
    });

    // Update the associated ride
    await tx.ride.update({
      where: { id: invoice.rideId },
      data: {
        paymentStatus: 'PAID',
        explanation: 'Payment confirmed by admin',
        status: 'CONFIRMED'
      }
    });

    return updatedInvoice;
  });
}

// =====================
// Enhanced Invoice Confirmation Endpoint
// =====================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let me: any = null; // Initialize to prevent scoping issues
  
  try {
    me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = parseInt(params.id);
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 });
    }

    // Rate limiting check
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = await rateLimiter.checkLimit(
      `admin:${clientIp}:confirm-payment`,
      5, // max 5 requests
      5 * 60 * 1000 // per 5 minutes
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429,
          headers: {
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetTime?.toString() || ''
          }
        }
      );
    }

    // Execute payment confirmation with transaction safety
    const invoice = await confirmPaymentTransaction(
      invoiceId,
      me.id.toString(),
      clientIp
    );

    // Enhanced audit logging
    await logAuditEvent(
      'admin_confirm_invoice_payment',
      me.id.toString(),
      {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.ride?.price || 0,
        userId: invoice.userId,
        userEmail: invoice.user?.email,
        severity: 'high',
        sessionId: request.headers.get('x-session-id') || 'unknown'
      },
      clientIp
    );

    // Send confirmation email (optional)
    try {
      // Add email confirmation logic here
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the main operation due to email issues
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: 'Payment confirmed successfully'
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    
    // Log failed attempt (only if me was successfully retrieved)
    if (me) {
      try {
        await logAuditEvent(
          'admin_confirm_payment_failed',
          me.id.toString(),
          {
            invoiceId: params.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            severity: 'medium'
          },
          request.headers.get('x-forwarded-for') || 'unknown'
        );
      } catch (auditError) {
        console.error('Failed to create audit log for failed attempt:', auditError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      {
        status: error instanceof Error && error.message.includes('not found') ? 404 : 500
      }
    );
  }
}