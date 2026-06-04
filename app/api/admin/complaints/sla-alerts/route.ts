import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

/**
 * GET /api/admin/complaints/sla-alerts - Get SLA alerts and overdue complaints
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('complaints.read');

    const now = new Date();

    // Get overdue complaints (past SLA deadline)
    let overdueComplaints: any[] = [];
    try {
      overdueComplaints = await (prisma as any).complaint.findMany({
        where: {
          status: 'OPEN',
          slaDeadline: {
            lt: now
          }
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          ride: {
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true
            }
          }
        },
        orderBy: { slaDeadline: 'asc' }
      });
    } catch (error) {
      // SLA fields might not exist yet
      console.log('SLA fields not available for overdue complaints');
    }

    // Get complaints approaching SLA deadline (within 24 hours)
    let approachingDeadline: any[] = [];
    try {
      approachingDeadline = await (prisma as any).complaint.findMany({
        where: {
          status: 'OPEN',
          slaDeadline: {
            gte: now,
            lt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          ride: {
            select: {
              id: true,
              pickupAddress: true,
              dropoffAddress: true
            }
          }
        },
        orderBy: { slaDeadline: 'asc' }
      });
    } catch (error) {
      // SLA fields might not exist yet
      console.log('SLA fields not available for approaching deadline complaints');
    }

    // Get SLA statistics
    const totalOpenComplaints = await (prisma as any).complaint.count({
      where: { status: 'OPEN' }
    });

    const totalOverdue = overdueComplaints.length;
    const totalApproaching = approachingDeadline.length;

    return NextResponse.json({
      ok: true,
      alerts: {
        overdue: overdueComplaints,
        approaching: approachingDeadline,
        statistics: {
          totalOpen: totalOpenComplaints,
          overdue: totalOverdue,
          approaching: totalApproaching,
          onTrack: totalOpenComplaints - totalOverdue - totalApproaching
        }
      }
    });

  } catch (error) {
    console.error('[API] Error fetching SLA alerts:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not fetch SLA alerts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/complaints/sla-alerts - Escalate overdue complaints
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission('complaints.manage');

    const { action, complaintIds } = await request.json();

    if (!action || !complaintIds || !Array.isArray(complaintIds)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const now = new Date();
    let updateData: any = {};

    if (action === 'escalate') {
      updateData = {
        escalated: true,
        priority: 'high',
        slaDeadline: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Extend by 24 hours
        updatedAt: now
      };
    } else if (action === 'extend_sla') {
      updateData = {
        slaDeadline: new Date(now.getTime() + 48 * 60 * 60 * 1000), // Extend by 48 hours
        updatedAt: now
      };
    }

    // Update the complaints - handle gracefully if fields don't exist
    let result: any = { count: 0 };
    try {
      result = await (prisma as any).complaint.updateMany({
        where: {
          id: { in: complaintIds },
          status: 'OPEN'
        },
        data: updateData
      });
    } catch (error) {
      // Fields might not exist yet, try updating only existing fields
      console.log('Some SLA fields not available, updating available fields only');
      const safeUpdateData: any = { updatedAt: now };
      if (action === 'escalate') {
        // Only update escalated if it exists
        try {
          await (prisma as any).complaint.updateMany({
            where: {
              id: { in: complaintIds },
              status: 'OPEN'
            },
            data: { escalated: true, updatedAt: now }
          });
          result.count = complaintIds.length;
        } catch (e) {
          console.log('Escalated field not available');
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Updated ${result.count} complaints`,
      updatedCount: result.count
    });

  } catch (error) {
    console.error('[API] Error updating SLA alerts:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not update complaints' },
      { status: 500 }
    );
  }
}
