import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

/**
 * POST /api/admin/complaints/[id] - Update complaint status and admin decision
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.type !== 'user' || (user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const complaintId = params.id;

    if (!complaintId || isNaN(Number(complaintId))) {
      return NextResponse.json(
        { ok: false, error: 'Invalid complaint ID' },
        { status: 400 }
      );
    }

    const complaint = await (prisma as any).complaint.findUnique({
      where: { id: Number(complaintId) },
    });

    if (!complaint) {
      return NextResponse.json(
        { ok: false, error: 'Complaint not found' },
        { status: 404 }
      );
    }

    const { status, adminDecision, category, priority, slaDeadline, responseTemplate } = await request.json();

    if (!status || !['OPEN', 'CLOSED', 'ACCEPTED'].includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Admin decision is required for CLOSED and ACCEPTED statuses
    if ((status === 'CLOSED' || status === 'ACCEPTED') && (!adminDecision || adminDecision.trim().length === 0)) {
      return NextResponse.json(
        { ok: false, error: 'Admin decision is required for closed/accepted complaints' },
        { status: 400 }
      );
    }

    // Set SLA deadline based on priority if not provided
    let finalSlaDeadline = slaDeadline;
    if (!finalSlaDeadline && status === 'OPEN') {
      const now = new Date();
      if (priority === 'high') {
        finalSlaDeadline = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
      } else if (priority === 'medium') {
        finalSlaDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      } else {
        finalSlaDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours
      }
    }

    const updatedComplaint = await (prisma as any).complaint.update({
      where: { id: Number(complaintId) },
      data: {
        status,
        adminDecision: adminDecision || null,
        category: category || 'other',
        priority: priority || 'medium',
        slaDeadline: finalSlaDeadline ? new Date(finalSlaDeadline) : null,
        responseTemplate: responseTemplate || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      complaint: {
        id: updatedComplaint.id,
        status: updatedComplaint.status,
        adminDecision: updatedComplaint.adminDecision,
        updatedAt: updatedComplaint.updatedAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('[API] Error updating complaint:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not update complaint' },
      { status: 500 }
    );
  }
}