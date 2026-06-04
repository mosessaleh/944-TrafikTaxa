import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requirePermission('risk.manage');

    const bookingId = params.id;

    if (!bookingId || isNaN(Number(bookingId))) {
      return NextResponse.json(
        { ok: false, error: 'Invalid booking ID' },
        { status: 400 }
      );
    }

    const booking = await (prisma as any).ride.findUnique({
      where: { id: Number(bookingId) },
    });

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    const { action, notes } = await request.json();

    if (!action || !['approve', 'reject', 'review', 'escalate', 'deescalate'].includes(action)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const updateData: any = {
      riskReviewed: true,
      riskApproved: action === 'approve',
      riskNotes: notes || null,
      updatedAt: new Date()
    };

    // Handle specific actions
    switch (action) {
      case 'approve':
        updateData.riskApproved = true;
        updateData.status = 'CONFIRMED'; // Approve the booking
        break;

      case 'reject':
        updateData.riskApproved = false;
        updateData.status = 'CANCELED'; // Cancel the booking
        updateData.explanation = 'Booking rejected due to risk assessment';
        break;

      case 'escalate':
        updateData.escalated = true;
        updateData.priority = 'high';
        // Extend SLA deadline by 24 hours
        if (booking.slaDeadline) {
          updateData.slaDeadline = new Date(new Date(booking.slaDeadline).getTime() + 24 * 60 * 60 * 1000);
        }
        break;

      case 'deescalate':
        updateData.escalated = false;
        updateData.priority = 'medium';
        break;

      case 'review':
        // Just mark as reviewed, don't change approval status
        updateData.riskReviewed = true;
        break;
    }

    const updatedBooking = await (prisma as any).ride.update({
      where: { id: Number(bookingId) },
      data: updateData,
    });

    // Log the action for audit purposes
    await prisma.auditLog.create({
      data: {
        event: 'risk_assessment_action',
        userId: user.id.toString(),
        metadata: {
          bookingId: bookingId,
          action: action,
          previousRiskLevel: booking.riskLevel,
          previousStatus: booking.status,
          newStatus: updatedBooking.status,
          notes: notes
        },
        severity: action === 'reject' ? 'high' : 'medium'
      }
    });

    return NextResponse.json({
      ok: true,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        riskReviewed: updatedBooking.riskReviewed,
        riskApproved: updatedBooking.riskApproved,
        escalated: updatedBooking.escalated
      }
    });

  } catch (error) {
    console.error('[API] Error updating booking risk:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not update booking risk assessment' },
      { status: 500 }
    );
  }
}
