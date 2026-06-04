import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import AdminPaymentsClient from '@/components/AdminPaymentsClient';
 
export default async function AdminPayments() {
  await requirePermission('payments.read');
 
  const paymentMethods = await (prisma as any).paymentMethod.findMany({
    orderBy: { createdAt: 'asc' }
  });
 
  return (
    <AdminPaymentsClient paymentMethods={paymentMethods} />
  );
}
