import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie, requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { getHighRiskBookings } from '@/lib/risk-assessment';
import { notifyAdmin } from '@/lib/notify';

/**
 * POST /api/admin/risk/alerts - Check for high-risk bookings and send alerts
 * This endpoint can be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    // Optional authentication - can be called by cron jobs
    const user = await getUserFromCookie();
    const isAdmin = user && user.type === 'user' && hasPermission((user as any).role, 'risk.read');

    // Get high-risk bookings that need attention
    const highRiskBookings = await getHighRiskBookings(10); // Top 10 high-risk bookings

    if (highRiskBookings.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No high-risk bookings requiring attention',
        alertsSent: 0
      });
    }

    // Categorize alerts
    const criticalBookings = highRiskBookings.filter(b => (b.riskLevel === 'critical' || b.riskScore! >= 80));
    const highRiskUnreviewed = highRiskBookings.filter(b => b.riskLevel === 'high' && !b.riskReviewed);
    const escalatedBookings = highRiskBookings.filter(b => b.escalated);

    let alertsSent = 0;

    // Send critical alerts (immediate attention required)
    if (criticalBookings.length > 0) {
      const subject = `🚨 CRITICAL: ${criticalBookings.length} Critical Risk Booking(s) Require Immediate Attention`;
      const htmlContent = generateAlertEmail(criticalBookings, 'critical');

      try {
        await notifyAdmin(subject, htmlContent);
        alertsSent++;

        // Log the alert
        await prisma.auditLog.create({
          data: {
            event: 'risk_alert_sent',
            metadata: {
              alertType: 'critical',
              bookingCount: criticalBookings.length,
              bookingIds: criticalBookings.map(b => b.id)
            },
            severity: 'critical'
          }
        });
      } catch (error) {
        console.error('Failed to send critical risk alert:', error);
      }
    }

    // Send high-risk alerts (review needed)
    if (highRiskUnreviewed.length > 0) {
      const subject = `⚠️ HIGH RISK: ${highRiskUnreviewed.length} High-Risk Booking(s) Need Review`;
      const htmlContent = generateAlertEmail(highRiskUnreviewed, 'high');

      try {
        await notifyAdmin(subject, htmlContent);
        alertsSent++;

        // Log the alert
        await prisma.auditLog.create({
          data: {
            event: 'risk_alert_sent',
            metadata: {
              alertType: 'high_risk',
              bookingCount: highRiskUnreviewed.length,
              bookingIds: highRiskUnreviewed.map(b => b.id)
            },
            severity: 'high'
          }
        });
      } catch (error) {
        console.error('Failed to send high-risk alert:', error);
      }
    }

    // Send escalation alerts
    if (escalatedBookings.length > 0) {
      const subject = `🔄 ESCALATED: ${escalatedBookings.length} Booking(s) Have Been Escalated`;
      const htmlContent = generateEscalationEmail(escalatedBookings);

      try {
        await notifyAdmin(subject, htmlContent);
        alertsSent++;

        // Log the alert
        await prisma.auditLog.create({
          data: {
            event: 'escalation_alert_sent',
            metadata: {
              alertType: 'escalation',
              bookingCount: escalatedBookings.length,
              bookingIds: escalatedBookings.map(b => b.id)
            },
            severity: 'medium'
          }
        });
      } catch (error) {
        console.error('Failed to send escalation alert:', error);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sent ${alertsSent} risk alert(s)`,
      alertsSent,
      criticalBookings: criticalBookings.length,
      highRiskBookings: highRiskUnreviewed.length,
      escalatedBookings: escalatedBookings.length
    });

  } catch (error) {
    console.error('[API] Error sending risk alerts:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not send risk alerts' },
      { status: 500 }
    );
  }
}

/**
 * Generate HTML email content for risk alerts
 */
function generateAlertEmail(bookings: any[], riskLevel: 'critical' | 'high'): string {
  const riskColor = riskLevel === 'critical' ? '#dc2626' : '#ea580c';
  const riskEmoji = riskLevel === 'critical' ? '🚨' : '⚠️';

  let html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: ${riskColor}; margin-bottom: 20px;">
        ${riskEmoji} ${riskLevel.toUpperCase()} Risk Alert
      </h1>

      <p style="color: #374151; margin-bottom: 20px;">
        The following booking(s) have been flagged as <strong>${riskLevel} risk</strong> and require immediate attention:
      </p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
  `;

  bookings.forEach((booking, index) => {
    html += `
      <div style="margin-bottom: 20px; padding-bottom: 15px; ${index < bookings.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
        <h3 style="color: #111827; margin: 0 0 10px 0;">
          Booking #${booking.id}
        </h3>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div>
            <strong>Customer:</strong> ${booking.user.firstName} ${booking.user.lastName}<br>
            <strong>Email:</strong> ${booking.user.email}
          </div>
          <div>
            <strong>Risk Score:</strong> <span style="color: ${riskColor}; font-weight: bold;">${booking.riskScore || 0}/100</span><br>
            <strong>Risk Level:</strong> ${booking.riskLevel || 'unknown'}
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <strong>Route:</strong> ${booking.pickupAddress} → ${booking.dropoffAddress}<br>
          <strong>Pickup Time:</strong> ${new Date(booking.pickupTime).toLocaleString('da-DK')}
        </div>

        ${booking.riskFactors && booking.riskFactors.length > 0 ? `
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; margin-top: 10px;">
            <strong>Risk Factors:</strong>
            <ul style="margin: 5px 0 0 20px; padding: 0;">
              ${booking.riskFactors.slice(0, 3).map((factor: any) =>
                `<li style="color: ${getSeverityColor(factor.severity)};">${factor.description} (+${factor.score})</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/risk"
           style="background: ${riskColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Review Risk Assessments
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 20px; text-align: center;">
        This alert was generated automatically by the risk management system.
      </p>
    </div>
  `;

  return html;
}

/**
 * Generate HTML email content for escalation alerts
 */
function generateEscalationEmail(bookings: any[]): string {
  let html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #7c3aed; margin-bottom: 20px;">
        🔄 Escalation Alert
      </h1>

      <p style="color: #374151; margin-bottom: 20px;">
        The following booking(s) have been <strong>escalated</strong> and require urgent attention:
      </p>

      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
  `;

  bookings.forEach((booking, index) => {
    html += `
      <div style="margin-bottom: 20px; padding-bottom: 15px; ${index < bookings.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
        <h3 style="color: #111827; margin: 0 0 10px 0;">
          Booking #${booking.id} (ESCALATED)
        </h3>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div>
            <strong>Customer:</strong> ${booking.user.firstName} ${booking.user.lastName}<br>
            <strong>Email:</strong> ${booking.user.email}
          </div>
          <div>
            <strong>Risk Score:</strong> ${booking.riskScore || 0}/100<br>
            <strong>Priority:</strong> ${booking.priority || 'unknown'}
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <strong>Route:</strong> ${booking.pickupAddress} → ${booking.dropoffAddress}<br>
          <strong>Pickup Time:</strong> ${new Date(booking.pickupTime).toLocaleString('da-DK')}
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/risk"
           style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Manage Escalated Cases
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 20px; text-align: center;">
        This escalation alert was generated automatically by the risk management system.
      </p>
    </div>
  `;

  return html;
}

/**
 * Get color for risk severity
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#d97706';
    default: return '#16a34a';
  }
}
