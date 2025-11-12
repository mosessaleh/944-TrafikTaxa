import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendEmail } from '@/lib/email';

// =====================
// Email Rate Limiting System (stricter than general rate limiting)
// =====================
class EmailRateLimiter {
  private requests = new Map<string, { count: number; resetTime: number; lastSent: Date | null }>();

  async checkEmailLimit(identifier: string, limit: number, windowMs: number, minIntervalMs: number) {
    const now = Date.now();
    const record = this.requests.get(identifier);
    
    // First time or window expired
    if (!record || now > record.resetTime) {
      this.requests.set(identifier, { count: 1, resetTime: now + windowMs, lastSent: new Date() });
      return { success: true, remaining: limit - 1 };
    }
    
    // Check minimum interval between emails
    if (record.lastSent && (now - record.lastSent.getTime()) < minIntervalMs) {
      return {
        success: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((minIntervalMs - (now - record.lastSent.getTime())) / 1000)
      };
    }
    
    // Check rate limit
    if (record.count >= limit) {
      return { success: false, remaining: 0, resetTime: record.resetTime };
    }
    
    record.count++;
    record.lastSent = new Date();
    return { success: true, remaining: limit - record.count };
  }
}

const emailRateLimiter = new EmailRateLimiter();

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
// Enhanced Send Reminder with Spam Protection
// =====================
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      await createAuditLog(
        'admin_unauthorized_email_attempt',
        'unknown',
        {
          action: 'send_reminder',
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
    // Stricter Email Rate Limiting
    // =====================
    const emailRateLimitKey = `email:${clientIp}:${invoiceId}`;
    const emailRateLimitResult = await emailRateLimiter.checkEmailLimit(
      emailRateLimitKey,
      1, // Only 1 email per invoice
      24 * 60 * 60 * 1000, // per 24 hours
      5 * 60 * 1000 // minimum 5 minutes between emails
    );

    if (!emailRateLimitResult.success) {
      await createAuditLog(
        'admin_email_rate_limit_exceeded',
        me.id.toString(),
        {
          action: 'send_reminder',
          invoiceId,
          reason: 'email_rate_limit_exceeded',
          severity: 'medium'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      
      const retryAfter = emailRateLimitResult.retryAfter || 300;
      
      return NextResponse.json(
        {
          error: 'Email reminder already sent recently. Please wait before sending another reminder.',
          retryAfter
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '1',
            'X-RateLimit-Remaining': '0',
            'Retry-After': retryAfter.toString()
          }
        }
      );
    }

    // =====================
    // Enhanced Invoice Validation
    // =====================
    const invoice = await (prisma as any).invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        ride: {
          include: {
            vehicleType: true,
          },
        },
      },
    });

    if (!invoice) {
      await createAuditLog(
        'admin_send_reminder_not_found',
        me.id.toString(),
        {
          action: 'send_reminder',
          invoiceId,
          reason: 'invoice_not_found',
          severity: 'medium'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Only send reminders for unpaid invoices
    if (invoice.paymentStatus === 'PAID') {
      await createAuditLog(
        'admin_send_reminder_paid_invoice',
        me.id.toString(),
        {
          action: 'send_reminder',
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          reason: 'invoice_already_paid',
          severity: 'low'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      
      return NextResponse.json({
        error: 'Cannot send reminder for already paid invoice'
      }, { status: 400 });
    }

    // =====================
    // Send Secure Reminder Email
    // =====================
    const securityToken = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    const subject = `Payment Reminder: Unpaid Invoice ${invoice.invoiceNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder: Unpaid Invoice</h2>
        <p>Dear ${invoice.user.firstName} ${invoice.user.lastName},</p>
        <p>This is a reminder that you have an unpaid invoice with 944 Trafik.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Booking ID:</strong> #${invoice.rideId}</p>
          <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString('en-US')}</p>
          <p><strong>Amount:</strong> ${invoice.ride.price.toLocaleString('en-US')} DKK</p>
          <p><strong>Vehicle Type:</strong> ${invoice.ride.vehicleType.title}</p>
        </div>
        <p>You can pay the invoice by logging into your account and following the payment instructions.</p>
        <p>If you have already paid this invoice, please ignore this reminder.</p>
        <p>Best regards,<br>944 Trafik Team</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          Security Token: ${securityToken}<br>
          Sent from IP: ${clientIp}<br>
          Invoice ID: ${invoiceId}
        </p>
      </div>
    `;

    // Send email with error handling
    let emailResult;
    try {
      emailResult = await sendEmail(invoice.user.email, subject, html);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      await createAuditLog(
        'admin_email_sending_failed',
        me.id.toString(),
        {
          action: 'send_reminder',
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          userEmail: invoice.user.email,
          error: emailError instanceof Error ? emailError.message : 'Email sending failed',
          severity: 'high'
        },
        clientIp,
        request.headers.get('user-agent') || 'unknown'
      );
      
      return NextResponse.json(
        { error: 'Failed to send email reminder. Please try again later.' },
        { status: 500 }
      );
    }

    // =====================
    // Successful Email Audit Logging
    // =====================
    await createAuditLog(
      'admin_send_reminder_success',
      me.id.toString(),
      {
        action: 'send_reminder',
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        userId: invoice.userId,
        userEmail: invoice.user.email,
        amount: invoice.ride?.price || 0,
        securityToken: securityToken.substring(0, 10) + '...', // Truncate for security
        severity: 'high'
      },
      clientIp,
      request.headers.get('user-agent') || 'unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'Reminder sent successfully',
      emailSent: true,
      remainingEmailRequests: emailRateLimitResult.remaining,
      userEmail: invoice.user.email
    });

  } catch (error) {
    console.error('Error sending reminder:', error);
    
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    
    await createAuditLog(
      'admin_send_reminder_error',
      'unknown',
      {
        action: 'send_reminder',
        invoiceId: params.id,
        error: error instanceof Error ? error.message : 'Internal server error',
        severity: 'high'
      },
      clientIp,
      request.headers.get('user-agent') || 'unknown'
    );
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}