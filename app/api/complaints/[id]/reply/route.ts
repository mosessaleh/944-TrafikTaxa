import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';

/**
 * POST /api/complaints/[id]/reply - Add reply to complaint conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookie();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
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

    // Check if user is admin or the complaint owner
    const isAdmin = user.type === 'user' && (user as any).role === 'ADMIN';
    const isOwner = complaint.userId === user.id;
    console.log('User check:', { userId: user.id, complaintUserId: complaint.userId, isAdmin, isOwner });

    if (!isAdmin && !isOwner) {
      console.log('Access denied for user:', user.id);
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    if (complaint.status !== 'OPEN') {
      return NextResponse.json(
        { ok: false, error: 'Cannot reply to closed complaint' },
        { status: 400 }
      );
    }

    const { reply } = await request.json();
    console.log('Received reply data:', { reply });

    if (!reply || typeof reply !== 'string' || reply.trim().length === 0) {
      console.log('Reply validation failed:', { reply, type: typeof reply, length: reply?.length });
      return NextResponse.json(
        { ok: false, error: 'Reply is required' },
        { status: 400 }
      );
    }

    // Get current conversation - parse JSON
    const currentConversation = JSON.parse(complaint.complaint);
    console.log('Current conversation before reply:', currentConversation);
    console.log('User type:', isAdmin ? 'Admin' : 'User');
    console.log('Reply content:', reply.trim());

    // Add reply based on user type
    if (isOwner) {
      // User replying - check if admin was the last to reply
      const lastMessage = currentConversation[currentConversation.length - 1];
      if (!lastMessage || !lastMessage.startsWith('Admin:')) {
        return NextResponse.json(
          { ok: false, error: 'Cannot reply until admin responds' },
          { status: 400 }
        );
      }
      // Add user reply
      const newConversation = [...currentConversation, `Me: ${reply.trim()}`];
      await (prisma as any).complaint.update({
        where: { id: Number(complaintId) },
        data: {
          complaint: JSON.stringify(newConversation),
          updatedAt: new Date(),
        },
      });
    } else if (isAdmin) {
      // Admin can always reply (no restrictions for admin)
      // Add admin reply
      const newConversation = [...currentConversation, `Admin: ${reply.trim()}`];
      console.log('New conversation after admin reply:', newConversation);
      await (prisma as any).complaint.update({
        where: { id: Number(complaintId) },
        data: {
          complaint: JSON.stringify(newConversation),
          updatedAt: new Date(),
        },
      });
      console.log('Database updated successfully for admin reply');
    }

    return NextResponse.json({
      ok: true,
      message: 'Reply added successfully'
    });

  } catch (error) {
    console.error('[API] Error adding reply:', error);
    console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { ok: false, error: 'Could not add reply' },
      { status: 500 }
    );
  }
}