import { prisma } from '@/lib/db';

export enum AuditEvent {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  EMAIL_VERIFICATION_SUCCESS = 'email_verification_success',

  // Booking events
  BOOKING_CREATED = 'booking_created',
  BOOKING_UPDATED = 'booking_updated',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_COMPLETED = 'booking_completed',

  // Payment events
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_SUCCESS = 'payment_success',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_REFUNDED = 'payment_refunded',

  // Admin events
  ADMIN_LOGIN = 'admin_login',
  ADMIN_ACTION = 'admin_action',
  SETTINGS_CHANGED = 'settings_changed',

  // Security events
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  INVALID_TOKEN = 'invalid_token',
}

export interface AuditLogData {
  event: AuditEvent;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class AuditLogger {
  static async log(data: AuditLogData): Promise<void> {
    try {
      const severity = data.severity || this.getDefaultSeverity(data.event);

      await prisma.auditLog.create({
        data: {
          event: data.event,
          userId: data.userId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata || {},
          severity,
          timestamp: new Date(),
        },
      });

      // Log critical events to console for immediate attention
      if (severity === 'critical' || severity === 'high') {
        console.warn(`[AUDIT ${severity.toUpperCase()}] ${data.event}:`, {
          userId: data.userId,
          ipAddress: data.ipAddress,
          metadata: data.metadata,
        });
      }
    } catch (error) {
      // Don't let audit logging failures break the main flow
      console.error('Failed to write audit log:', error);
    }
  }

  private static getDefaultSeverity(event: AuditEvent): 'low' | 'medium' | 'high' | 'critical' {
    switch (event) {
      case AuditEvent.LOGIN_FAILED:
      case AuditEvent.INVALID_TOKEN:
      case AuditEvent.RATE_LIMIT_EXCEEDED:
        return 'medium';

      case AuditEvent.SUSPICIOUS_ACTIVITY:
      case AuditEvent.PAYMENT_FAILED:
        return 'high';

      case AuditEvent.ADMIN_LOGIN:
      case AuditEvent.ADMIN_ACTION:
        return 'high';

      default:
        return 'low';
    }
  }

  // Helper methods for common audit events
  static async logLoginSuccess(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      event: AuditEvent.LOGIN_SUCCESS,
      userId,
      ipAddress,
      userAgent,
      severity: 'low',
    });
  }

  static async logLoginFailed(email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.log({
      event: AuditEvent.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { email },
      severity: 'medium',
    });
  }

  static async logBookingCreated(userId: string, bookingId: number, amount: number, ipAddress?: string): Promise<void> {
    await this.log({
      event: AuditEvent.BOOKING_CREATED,
      userId,
      ipAddress,
      metadata: { bookingId, amount },
      severity: 'low',
    });
  }

  static async logPaymentSuccess(userId: string, bookingId: number, amount: number, method: string): Promise<void> {
    await this.log({
      event: AuditEvent.PAYMENT_SUCCESS,
      userId,
      metadata: { bookingId, amount, method },
      severity: 'low',
    });
  }

  static async logSuspiciousActivity(ipAddress: string, reason: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      event: AuditEvent.SUSPICIOUS_ACTIVITY,
      ipAddress,
      metadata: { reason, ...metadata },
      severity: 'high',
    });
  }

  static async logRateLimitExceeded(ipAddress: string, endpoint: string, limit: number): Promise<void> {
    await this.log({
      event: AuditEvent.RATE_LIMIT_EXCEEDED,
      ipAddress,
      metadata: { endpoint, limit },
      severity: 'medium',
    });
  }
}

// Middleware helper for automatic audit logging
export function createAuditMiddleware(event: AuditEvent, getMetadata?: (req: Request, userId?: string) => Record<string, any>) {
  return async (req: Request, userId?: string) => {
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    const userAgent = req.headers.get('user-agent') || undefined;

    const metadata = getMetadata ? getMetadata(req, userId) : {};

    await AuditLogger.log({
      event,
      userId,
      ipAddress,
      userAgent,
      metadata,
    });
  };
}