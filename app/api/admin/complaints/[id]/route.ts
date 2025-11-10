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
    if (!user || user.role !== 'ADMIN') {
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

    const { status, adminDecision } = await request.json();

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

    const updatedComplaint = await (prisma as any).complaint.update({
      where: { id: Number(complaintId) },
      data: {
        status,
        adminDecision: adminDecision || null,
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