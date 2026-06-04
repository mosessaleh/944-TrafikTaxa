import { requirePermission } from '@/lib/auth';
import { prisma } from '@/lib/db';
import AdminPartnerVehiclesClient from '@/components/AdminPartnerVehiclesClient';

export default async function AdminPartnerVehiclesPage() {
  await requirePermission('partners.read');

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

  // Convert dates to strings for compatibility
  const vehiclesWithStringDates = vehicles.map(vehicle => ({
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    lastLocationUpdate: (vehicle as any).lastLocationUpdate?.toISOString() || null,
  }));

  return <AdminPartnerVehiclesClient initialVehicles={vehiclesWithStringDates} />;
}
