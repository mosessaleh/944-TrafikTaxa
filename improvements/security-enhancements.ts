import { prisma } from '../lib/db';
import { randomBytes, createHash } from 'crypto';
// Invoice System Security Enhancements
// 1. Rate Limiting Implementation
// 2. Enhanced Audit Logging
// 3. Transaction Safety for Financial Operations
// 4. Additional Protection Against Attacks

// 1. Rate Limiting Implementation
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

// 2. Enhanced Audit Logging
interface AuditLogData {
  event: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

async function createAuditLog(data: AuditLogData) {
  // Enhanced audit logging with structured data
  console.log('[AUDIT]', JSON.stringify({
    ...data,
    timestamp: new Date().toISOString(),
    sessionId: data.metadata.sessionId || 'unknown'
  }));
  
  // Could be enhanced to store in database
  // await prisma.auditLog.create({ data });
}

// 3. Transaction Safety
async function confirmPaymentSafely(invoiceId: number) {
  return await prisma.$transaction(async (tx) => {
    // Check if invoice exists and validate status
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { ride: true }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.paymentStatus === 'PAID') {
      throw new Error('Invoice already paid');
    }

    // Update invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: { 
        paymentStatus: 'PAID',
        updatedAt: new Date()
      }
    });

    // Update ride
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

// 4. Enhanced Email Security
async function sendSecureReminder(invoice: any) {
  // Add tokens to verify request authenticity
  const reminderToken = generateSecureToken();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Påmindelse om ubetalt faktura</h2>
      <p>Kære ${invoice.user.firstName} ${invoice.user.lastName},</p>
      <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 5px;">
        <p><strong>Faktura nummer:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Forfaldsdato:</strong> ${new Date(invoice.dueDate).toLocaleDateString('da-DK')}</p>
        <p><strong>Beløb:</strong> ${invoice.ride.price.toLocaleString('da-DK')} DKK</p>
      </div>
      <p>Du kan betale fakturaen ved at logge ind på din konto.</p>
      <p>Med venlig hilsen,<br>944 Trafik Team</p>
      <hr>
      <p style="font-size: 12px; color: #666;">
        Sikkerhedstoken: ${reminderToken}
      </p>
    </div>
  `;
}

function generateSecureToken() {
  // Use crypto for secure token generation instead of Math.random()
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token + Date.now().toString()).digest('hex');
  return hash.substring(0, 16);
}

// 5. More Detailed Permission System
enum Permission {
  VIEW_INVOICES = 'view_invoices',
  MANAGE_INVOICES = 'manage_invoices',
  SEND_REMINDERS = 'send_reminders',
  CONFIRM_PAYMENTS = 'confirm_payments',
  CANCEL_INVOICES = 'cancel_invoices'
}

function hasPermission(userRole: string, requiredPermission: Permission): boolean {
  const rolePermissions: Record<string, Permission[]> = {
    ADMIN: Object.values(Permission),
    MANAGER: [Permission.VIEW_INVOICES, Permission.SEND_REMINDERS],
    USER: []
  };
  
  return rolePermissions[userRole]?.includes(requiredPermission) || false;
}