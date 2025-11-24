import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import { sendPaymentReminderEmail, sendLateFeeNotificationEmail } from '@/lib/mail';

interface InvoiceWithUser {
  id: number;
  invoiceNumber: string;
  userId: number;
  rideId: number;
  dueDate: Date;
  paymentStatus: string;
  status: number;
  createdAt: Date;
  updatedAt: Date | null;
  paymentMethod: string | null;
  paymentRef: string | null;
  paymentDate: Date | null;
  paymentAmount: number | null;
  paymentNotes: string | null;
  confirmedBy: number | null;
  confirmedAt: Date | null;
  receiptNumber: string | null;
  lateFee1: number | null;
  lateFee2: number | null;
  lateFee1Date: Date | null;
  lateFee2Date: Date | null;
  extendedDueDate: Date | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  ride: {
    id: number;
    price: number;
    status: string;
    paymentStatus: string;
  };
}

interface InvoiceWithPriority extends InvoiceWithUser {
  priority: 'high' | 'medium' | 'low';
  isOverdue: boolean;
  daysUntilDue: number;
  totalAmount: number;
}

export async function GET(request: NextRequest) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(Number(limitParam || '200'), 1), 1000);

    // Get unpaid invoices with user and ride information
    const invoices = await prisma.invoice.findMany({
      where: {
        paymentStatus: {
          in: ['UNPAID', 'OVERDUE']
        },
        status: 1, // Active invoices only
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        ride: {
          select: {
            id: true,
            price: true,
            status: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: [
        { dueDate: 'asc' }, // Sort by due date first
        { createdAt: 'desc' }, // Then by creation date
      ],
      take: limit,
    });

    // Calculate priority and overdue status for each invoice
    const now = new Date();
    const invoicesWithPriority = invoices.map((invoice: any) => {
      const dueDate = new Date(invoice.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDue < 0;

      let priority: 'high' | 'medium' | 'low' = 'low';
      if (isOverdue) {
        priority = 'high';
      } else if (daysUntilDue <= 3) {
        priority = 'medium';
      }

      return {
        ...invoice,
        priority,
        isOverdue,
        daysUntilDue: Math.abs(daysUntilDue),
        totalAmount: calculateTotalAmount(invoice),
      };
    });

    // Sort by priority (high first), then by due date
    invoicesWithPriority.sort((a: InvoiceWithPriority, b: InvoiceWithPriority) => {
      const priorityOrder: Record<'high' | 'medium' | 'low', number> = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return NextResponse.json({
      ok: true,
      count: invoicesWithPriority.length,
      invoices: invoicesWithPriority,
    });
  } catch (error) {
    console.error('Error fetching admin invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await getUserFromCookie();
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, invoiceId } = body;

    if (!invoiceId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(invoiceId) },
      include: { user: true, ride: true }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    switch (action) {
      case 'confirm_payment':
        await prisma.invoice.update({
          where: { id: parseInt(invoiceId) },
          data: {
            paymentStatus: 'PAID',
            paymentDate: new Date(),
            confirmedBy: me.id,
            confirmedAt: new Date(),
          }
        });
        return NextResponse.json({ success: true, message: 'Payment confirmed' });

      case 'send_reminder':
        // Send payment reminder email
        const reminderResult = await sendPaymentReminderEmail(
          invoice.user.email,
          invoice.invoiceNumber,
          invoice.dueDate.toISOString(),
          invoice.paymentAmount || invoice.ride?.price || 0
        );

        if (!reminderResult.sent) {
          return NextResponse.json(
            { error: `Failed to send reminder email: ${reminderResult.reason}` },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: 'Reminder sent successfully' });

      case 'send_late_fee':
        const baseAmount = invoice.paymentAmount || invoice.ride?.price || 0;
        const lateFeeAmount = 100 + (baseAmount * 0.057); // 100 DKK + 5.7% of invoice amount
        const newDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
        const totalAmount = baseAmount + lateFeeAmount;

        await (prisma.invoice.update as any)({
          where: { id: parseInt(invoiceId) },
          data: {
            lateFee1: lateFeeAmount,
            lateFee1Date: new Date(),
            extendedDueDate: newDueDate,
            paymentStatus: 'OVERDUE',
          }
        });

        // Send late fee notification email
        const lateFeeResult = await sendLateFeeNotificationEmail(
          invoice.user.email,
          invoice.invoiceNumber,
          lateFeeAmount,
          newDueDate.toISOString(),
          totalAmount
        );

        if (!lateFeeResult.sent) {
          return NextResponse.json(
            { error: `Late fee applied but email failed: ${lateFeeResult.reason}` },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, message: 'Late fee applied and notification sent successfully' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing invoice action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

function calculateTotalAmount(invoice: any): number {
  const baseAmount = invoice.paymentAmount || invoice.ride?.price || 0;
  const lateFee1 = invoice.lateFee1 || 0;
  const lateFee2 = invoice.lateFee2 || 0;
  return baseAmount + lateFee1 + lateFee2;
}