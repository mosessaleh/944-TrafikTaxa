import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

/**
 * GET /api/admin/complaints/analytics - Get complaint analytics data
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('complaints.read');

    // Get total counts
    const totalComplaints = await (prisma as any).complaint.count();
    const openComplaints = await (prisma as any).complaint.count({
      where: { status: 'OPEN' }
    });
    const closedComplaints = await (prisma as any).complaint.count({
      where: { status: { in: ['CLOSED', 'ACCEPTED'] } }
    });

    // Get overdue complaints - handle gracefully if field doesn't exist
    let overdueComplaints = 0;
    try {
      const now = new Date();
      overdueComplaints = await (prisma as any).complaint.count({
        where: {
          status: 'OPEN',
          slaDeadline: {
            lt: now
          }
        }
      });
    } catch (error) {
      // slaDeadline field might not exist yet, use 0
      console.log('slaDeadline field not available, using 0 for overdue');
    }

    // Category breakdown - handle gracefully if field doesn't exist
    let categoryBreakdown: { [key: string]: number } = { other: totalComplaints };
    try {
      const categoryResults = await (prisma as any).complaint.groupBy({
        by: ['category'],
        _count: {
          id: true
        },
        where: {
          category: {
            not: null
          }
        }
      });
      categoryBreakdown = {};
      categoryResults.forEach((result: any) => {
        categoryBreakdown[result.category || 'other'] = result._count.id;
      });
    } catch (error) {
      // Field doesn't exist yet, use defaults
      console.log('Category field not available, using defaults');
    }

    // Priority breakdown - handle gracefully if field doesn't exist
    let priorityBreakdown: { [key: string]: number } = { medium: totalComplaints };
    try {
      const priorityResults = await (prisma as any).complaint.groupBy({
        by: ['priority'],
        _count: {
          id: true
        },
        where: {
          priority: {
            not: null
          }
        }
      });
      priorityBreakdown = {};
      priorityResults.forEach((result: any) => {
        priorityBreakdown[result.priority || 'medium'] = result._count.id;
      });
    } catch (error) {
      // Field doesn't exist yet, use defaults
      console.log('Priority field not available, using defaults');
    }

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyResults = await (prisma as any).$queryRaw`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as month,
        COUNT(*) as count
      FROM complaint
      WHERE createdAt >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month
    `;

    const monthlyTrend = (monthlyResults as any[]).map(result => ({
      month: result.month,
      count: Number(result.count)
    }));

    // Calculate average resolution time (in hours)
    const resolvedComplaints = await (prisma as any).complaint.findMany({
      where: {
        status: { in: ['CLOSED', 'ACCEPTED'] },
        updatedAt: { not: null }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    });

    let averageResolutionTime = 0;
    if (resolvedComplaints.length > 0) {
      const totalHours = resolvedComplaints.reduce((sum: number, complaint: any) => {
        const created = new Date(complaint.createdAt);
        const updated = new Date(complaint.updatedAt!);
        const hours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      averageResolutionTime = Math.round(totalHours / resolvedComplaints.length);
    }

    return NextResponse.json({
      ok: true,
      analytics: {
        totalComplaints,
        openComplaints,
        closedComplaints,
        overdueComplaints,
        categoryBreakdown,
        priorityBreakdown,
        monthlyTrend,
        averageResolutionTime
      }
    });

  } catch (error) {
    console.error('[API] Error fetching complaint analytics:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not fetch analytics data' },
      { status: 500 }
    );
  }
}
