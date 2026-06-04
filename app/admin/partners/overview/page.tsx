import { Suspense } from 'react';
import { requirePermission } from '@/lib/auth';
import { AdminPartnerOverviewClient } from '@/components/AdminPartnerOverviewClient';

export default async function AdminPartnerOverviewPage() {
  await requirePermission('partners.read');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Partner Companies Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Comprehensive overview of all partner companies and their performance metrics.
        </p>
      </div>

      <Suspense fallback={<div className="text-center py-8">Loading overview...</div>}>
        <AdminPartnerOverviewClient />
      </Suspense>
    </div>
  );
}
