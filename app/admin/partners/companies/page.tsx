import { prisma } from '@/lib/db';
import AdminPartnerCompaniesClient, { PartnerCompany } from '@/components/AdminPartnerCompaniesClient';

export default async function AdminPartnerCompanies() {
  const raw = await prisma.partnerCompany.findMany({
    orderBy: { id: 'desc' },
    select: {
      id: true,
      cvr: true,
      comName: true,
      contactPerson: true,
      comAddress: true,
      comPhone: true,
      comEmail: true,
      comBankInfo: true,
      comStatus: true,
      commissionRate: true,
      contractSigned: true,
      comUserName: true,
      createdAt: true,
      updatedAt: true,
    }
  });

  const partners: PartnerCompany[] = raw.map((p) => ({
    id: p.id,
    cvr: p.cvr,
    comName: p.comName,
    contactPerson: p.contactPerson,
    comAddress: p.comAddress,
    comPhone: p.comPhone,
    comEmail: p.comEmail,
    comBankInfo: p.comBankInfo,
    comStatus: p.comStatus,
    commissionRate: p.commissionRate,
    contractSigned: p.contractSigned,
    comUserName: p.comUserName,
    createdAt: p.createdAt ? p.createdAt.toISOString() : null,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
  }));

  return (
    <div className="grid gap-4">
      <AdminPartnerCompaniesClient initialPartners={partners} />
    </div>
  );
}