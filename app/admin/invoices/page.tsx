import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import AdminInvoicesClient from '@/components/AdminInvoicesClient';

type InvoiceWithPriority = {
  id: number;
  invoiceNumber: string;
  userId: number;
  rideId: number;
  createdAt: string;
  dueDate: string;
  dueDateFormatted: string;
  status: number;
  paymentStatus: string;
  paymentMethod?: string;
  paymentRef?: string;
  paymentDate?: string;
  paymentAmount?: number;
  paymentNotes?: string;
  confirmedBy?: number;
  confirmedAt?: string;
  receiptNumber?: string;
  lateFee1?: number;
  lateFee2?: number;
  lateFee1Date?: string;
  lateFee2Date?: string;
  extendedDueDate?: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  ride: {
    id: number;
    price: number;
  };
  priority: 'high' | 'medium' | 'low';
  isOverdue: boolean;
  daysUntilDue: number;
  totalAmount: number;
};

export default async function AdminInvoicesPage() {
  const me = await getUserFromCookie();
  if (!me || me.role !== 'ADMIN') {
    return (
      <div className="max-w-xl mx-auto grid gap-4">
        <h1 className="text-3xl font-bold">Admin</h1>
        <div className="border rounded-2xl p-4 bg-yellow-50 text-yellow-900">
          <div className="font-semibold">Access restricted</div>
          <div className="text-sm mt-1">You must be an administrator to view this page.</div>
          <div className="mt-3"><Link href="/" className="underline">Go back home</Link></div>
        </div>
      </div>
    );
  }

  // Fetch initial invoices data on server side
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
    take: 200, // Initial limit
  });

  // Calculate priority and overdue status for each invoice
  const now = new Date();
  const invoicesWithPriority: InvoiceWithPriority[] = invoices.map((invoice: any) => {
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
      createdAt: invoice.createdAt.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      dueDateFormatted: new Date(invoice.dueDate).toLocaleDateString(),
      confirmedAt: invoice.confirmedAt?.toISOString(),
      paymentDate: invoice.paymentDate?.toISOString(),
      lateFee1Date: invoice.lateFee1Date?.toISOString(),
      lateFee2Date: invoice.lateFee2Date?.toISOString(),
      extendedDueDate: invoice.extendedDueDate?.toISOString(),
      priority,
      isOverdue,
      daysUntilDue: Math.abs(daysUntilDue),
      totalAmount: calculateTotalAmount(invoice),
    };
  });

  // Sort by priority (high first), then by due date
  invoicesWithPriority.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 } as const;
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return <AdminInvoicesClient initialInvoices={invoicesWithPriority} />;
}

function calculateTotalAmount(invoice: any): number {
  const baseAmount = invoice.paymentAmount || invoice.ride?.price || 0;
  const lateFee1 = invoice.lateFee1 || 0;
  const lateFee2 = invoice.lateFee2 || 0;
  return baseAmount + lateFee1 + lateFee2;
}