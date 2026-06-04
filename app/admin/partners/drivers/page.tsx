import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import AdminDriversClient, { Driver } from '@/components/AdminDriversClient';

function maskSensitive(value: string | null | undefined, visibleTail = 4) {
  if (!value) return '';
  if (value.length <= visibleTail) return '*'.repeat(value.length);
  return `${'*'.repeat(Math.max(0, value.length - visibleTail))}${value.slice(-visibleTail)}`;
}

export default async function AdminDrivers() {
  await requirePermission('drivers.read');

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

  const companies = await prisma.partnerCompany.findMany({
    select: {
      id: true,
      comName: true,
    },
    orderBy: { comName: 'asc' }
  });

  const drivers: Driver[] = await Promise.all(raw.map(async (d) => {
    return {
      id: d.id,
      comId: d.comId,
      companyName: d.company.comName,
      cpr: maskSensitive(d.cpr),
      drFname: d.drFname,
      drLname: d.drLname,
      sex: d.sex as 'MALE' | 'FEMALE',
      drAddress: d.drAddress,
      drPhone: d.drPhone,
      drEmail: d.drEmail,
      drPhoto: d.drPhoto,
      licenceNr: d.licenceNr,
      drCard: d.drCard,
      rating: Number(d.rating),
      isOnline: d.isOnline,
      isActive: d.isActive,
      isBusy: d.isBusy,
      bannedUntil: d.bannedUntil ? d.bannedUntil.toISOString() : null,
      car: d.car,
      currentRideId: d.currentRideId,
      drUsername: d.drUsername,
      apiKey: (d as any).apiKey ? maskSensitive((d as any).apiKey, 6) : null,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    };
  }));

  return (
    <div className="grid gap-4">
      <AdminDriversClient initialDrivers={drivers} companies={companies} />
    </div>
  );
}
