import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

/**
 * GET /api/admin/complaints - Get all complaints for admin
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromCookie();
    if (!user || user.type !== 'user' || (user as any).role !== 'ADMIN') {
      return NextResponse.json(
        { ok: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const complaints = await (prisma as any).complaint.findMany({
      select: {
        id: true,
        userId: true,
        rideId: true,
        complaint: true,
        status: true,
        adminDecision: true,
        createdAt: true,
        updatedAt: true,
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
            dropoffAddress: true,
            pickupTime: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add default values for new fields that might not exist yet
    const complaintsWithDefaults = complaints.map((complaint: any) => ({
      ...complaint,
      category: complaint.category || 'other',
      priority: complaint.priority || 'medium',
      slaDeadline: complaint.slaDeadline || null,
      escalated: complaint.escalated || false,
      responseTemplate: complaint.responseTemplate || null
    }));

    return NextResponse.json({
      ok: true,
      complaints: complaintsWithDefaults
    });

  } catch (error) {
    console.error('[API] Error fetching complaints:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not fetch complaints' },
      { status: 500 }
    );
  }
}