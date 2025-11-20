import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import AdminComplaintsClient from '@/components/AdminComplaintsClient';
import { ArrowLeft } from 'lucide-react';

export default async function AdminComplaints() {
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

  const complaints = await (prisma as any).complaint.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      ride: {
        select: {
          id: true,
          pickupAddress: true,
          dropoffAddress: true,
          pickupTime: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage customer complaints.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <AdminComplaintsClient initialComplaints={complaints} />
      </div>
    </div>
  );
}