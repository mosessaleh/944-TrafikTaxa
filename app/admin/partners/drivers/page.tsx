import { prisma } from '@/lib/db';
import AdminDriversClient, { Driver } from '@/components/AdminDriversClient';

export default async function AdminDrivers() {
  const raw = await prisma.comDriver.findMany({
    include: {
      company: {
        select: {
          comName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  const drivers: Driver[] = raw.map((d) => ({
    id: d.id,
    comId: d.comId,
    companyName: d.company.comName,
    cpr: d.cpr,
    drFname: d.drFname,
    drLname: d.drLname,
    sex: d.sex,
    drAddress: d.drAddress,
    drPhone: d.drPhone,
    drEmail: d.drEmail,
    licenceNr: d.licenceNr,
    drCard: d.drCard,
    rating: d.rating,
    isOnline: d.isOnline,
    isActive: d.isActive,
    car: d.car,
    currentRideId: d.currentRideId,
    drUsername: d.drUsername,
    createdAt: d.createdAt ? d.createdAt.toISOString() : null,
  }));

  return (
    <div className="grid gap-4">
      <AdminDriversClient initialDrivers={drivers} />
    </div>
  );
}