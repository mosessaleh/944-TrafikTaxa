import { redirect } from 'next/navigation';
import { getUserFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface InvoicePageProps {
  params: {
    id: string;
  };
}

export default async function InvoicePage({ params }: InvoicePageProps) {
  const me = await getUserFromCookie();

  if (!me) {
    redirect('/login');
  }

  const invoiceId = parseInt(params.id);
  if (isNaN(invoiceId)) {
    redirect('/account?tab=invoices');
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      user: true,
      ride: {
        include: {
          vehicleType: true,
        },
      },
    },
  });

  if (!invoice || invoice.userId !== me.id) {
    redirect('/account?tab=invoices');
  }

  // Redirect to the existing invoice generation endpoint
  redirect(`/api/bookings/${invoice.rideId}/invoice`);
}