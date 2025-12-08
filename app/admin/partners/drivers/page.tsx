import { prisma } from '@/lib/db';
import { decryptCPR } from '@/lib/crypto';
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

  const companies = await prisma.partnerCompany.findMany({
    select: {
      id: true,
      comName: true,
    },
    orderBy: { comName: 'asc' }
  });

  const drivers: Driver[] = await Promise.all(raw.map(async (d) => {
    let decryptedCpr = d.cpr;
    try {
      decryptedCpr = decryptCPR(d.cpr);
    } catch (error) {
      console.error(`Failed to decrypt CPR for driver ${d.id}:`, error);
      decryptedCpr = 'DECRYPTION_ERROR';
    }

    return {
      id: d.id,
      comId: d.comId,
      companyName: d.company.comName,
      cpr: decryptedCpr,
      drFname: d.drFname,
      drLname: d.drLname,
      sex: d.sex,
      drAddress: d.drAddress,
      drPhone: d.drPhone,
      drEmail: d.drEmail,
      drPhoto: d.drPhoto,
      licenceNr: d.licenceNr,
      drCard: d.drCard,
      rating: d.rating,
      isOnline: d.isOnline,
      isActive: d.isActive,
      car: d.car,
      currentRideId: d.currentRideId,
      drUsername: d.drUsername,
      apiKey: (d as any).apiKey,
      createdAt: d.createdAt ? d.createdAt.toISOString() : null,
    };
  }));

  return (
    <div className="grid gap-4">
      <AdminDriversClient initialDrivers={drivers} companies={companies} />
    </div>
  );
}