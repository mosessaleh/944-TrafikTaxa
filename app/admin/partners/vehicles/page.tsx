import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AdminPartnerVehiclesClient from '@/components/AdminPartnerVehiclesClient';

export default async function AdminPartnerVehiclesPage() {
  // Require admin authentication
  await requireAdmin();

  // Fetch vehicles with company information
  const vehicles = await prisma.comVehicles.findMany({
    include: {
      company: {
        select: {
          comName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  return <AdminPartnerVehiclesClient initialVehicles={vehicles} />;
}