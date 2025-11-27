import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { clientIpKey, limitOrThrow } from '@/lib/rate-limit';
import { notifyAdmin } from '@/lib/notify';

/**
 * GET /api/complaints?rideId=X - Get complaint for a specific ride
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rideId = searchParams.get('rideId');

    if (!rideId || isNaN(Number(rideId))) {
      return NextResponse.json(
        { ok: false, error: 'Invalid ride ID' },
        { status: 400 }
      );
    }

    const complaint = await (prisma as any).complaint.findFirst({
      where: {
        rideId: Number(rideId),
        userId: user.id,
      },
    });

    if (!complaint) {
      return NextResponse.json({
        ok: true,
        hasComplaint: false
      });
    }

    // Handle both old string format and new JSON format
    let complaintMessages: string[];
    try {
      const parsed = JSON.parse(complaint.complaint);
      if (Array.isArray(parsed)) {
        complaintMessages = parsed;
      } else {
        complaintMessages = [complaint.complaint];
      }
    } catch (e) {
      // If JSON parsing fails, treat as old string format
      complaintMessages = [complaint.complaint];
    }

    return NextResponse.json({
      ok: true,
      hasComplaint: true,
      complaint: {
        id: complaint.id,
        rideId: complaint.rideId,
        complaint: complaintMessages, // Use the parsed messages
        status: complaint.status,
        adminDecision: complaint.adminDecision,
        createdAt: complaint.createdAt.toISOString(),
        updatedAt: complaint.updatedAt.toISOString(),
      }
    });

  } catch (error) {
    console.error('[API] Error fetching complaint:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not fetch complaint' },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/complaints?rideId=X - Cancel/delete complaint for a specific ride
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rideId = searchParams.get('rideId');

    if (!rideId || isNaN(Number(rideId))) {
      return NextResponse.json(
        { ok: false, error: 'Invalid ride ID' },
        { status: 400 }
      );
    }

    const complaint = await (prisma as any).complaint.findFirst({
      where: {
        rideId: Number(rideId),
        userId: user.id,
      },
    });

    if (!complaint) {
      return NextResponse.json({
        ok: true,
        hasComplaint: false
      });
    }

    // Handle both old string format and new JSON format
    let complaintMessages: string[];
    try {
      const parsed = JSON.parse(complaint.complaint);
      if (Array.isArray(parsed)) {
        complaintMessages = parsed;
      } else {
        complaintMessages = [complaint.complaint];
      }
    } catch (e) {
      // If JSON parsing fails, treat as old string format
      complaintMessages = [complaint.complaint];
    }

    // Only allow cancellation if status is OPEN
    if (complaint.status !== 'OPEN') {
      return NextResponse.json(
        { ok: false, error: 'Cannot cancel complaint that has been reviewed' },
        { status: 400 }
      );
    }

    await (prisma as any).complaint.delete({
      where: { id: complaint.id },
    });

    return NextResponse.json({
      ok: true,
      message: 'Complaint cancelled successfully'
    });

  } catch (error) {
    console.error('[API] Error cancelling complaint:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not cancel complaint' },
      { status: 500 }
    );
  }
}

// Validation schema for complaint creation
const createComplaintSchema = z.object({
  rideId: z.number().int().positive("Invalid ride ID"),
  complaint: z.string()
    .min(1, "Complaint cannot be empty")
    .max(1000, "Complaint is too long"),
});

/**
 * POST /api/complaints - Create a new complaint
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await limitOrThrow('complaints:' + clientIpKey(request), { points: 5, durationSec: 300 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: 'Too many requests, try again later.' },
      { status: error?.status || 429 }
    );
  }

  try {
    // Authentication
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (user.type === 'user' && !((user as any).emailVerified)) {
      return NextResponse.json(
        { ok: false, error: 'Email verification required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const rawData = await request.json();
    const validatedData = createComplaintSchema.parse(rawData);

    // Verify the ride belongs to the user
    const ride = await prisma.ride.findFirst({
      where: {
        id: validatedData.rideId,
        userId: user.id,
      },
    });

    if (!ride) {
      return NextResponse.json(
        { ok: false, error: 'Ride not found or access denied' },
        { status: 404 }
      );
    }

    // Check if user already submitted a complaint for this ride
    const existingComplaint = await (prisma as any).complaint.findFirst({
      where: {
        rideId: validatedData.rideId,
        userId: user.id,
      },
    });

    if (existingComplaint) {
      return NextResponse.json(
        { ok: false, error: 'You have already submitted a complaint for this ride' },
        { status: 400 }
      );
    }

    // Create complaint as array for conversation
    const complaint = await (prisma as any).complaint.create({
      data: {
        userId: user.id,
        rideId: validatedData.rideId,
        complaint: JSON.stringify([`Me: ${validatedData.complaint}`]), // Store as JSON string
        status: 'OPEN',
      },
    });

    // Send notification to admin (async, don't wait)
    const adminEmail = process.env.ADMIN_EMAIL || process.env.CONTACT_EMAIL;
    if (adminEmail) {
      import('@/lib/email').then(({ sendEmail }) =>
        sendEmail(
          adminEmail,
          `New Customer Complaint - Booking #${validatedData.rideId}`,
          `<p>A new complaint has been submitted:</p>
          <ul>
            <li><strong>Customer:</strong> ${(user as any).firstName} ${(user as any).lastName} (${(user as any).email})</li>
            <li><strong>Booking ID:</strong> ${validatedData.rideId}</li>
            <li><strong>Complaint:</strong> ${validatedData.complaint}</li>
          </ul>
          <p>Please review this complaint in the admin panel.</p>`
        )
      ).catch((error) => {
        console.error('[API] Failed to send admin notification:', error);
      });
    }

    return NextResponse.json({
      ok: true,
      complaint: {
        id: complaint.id,
        rideId: complaint.rideId,
        complaint: JSON.parse(complaint.complaint), // Parse JSON back to array
        status: complaint.status,
        createdAt: complaint.createdAt.toISOString(),
      }
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Error creating complaint:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    // Log the actual error for debugging
    console.error('[API] Detailed error:', error);
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      { ok: false, error: 'Could not submit complaint. Please try again.' },
      { status: 500 }
    );
  }
}