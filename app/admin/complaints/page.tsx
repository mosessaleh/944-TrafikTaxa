import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import AdminComplaintsClient from '@/components/AdminComplaintsClient';

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
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Complaints Management</h1>
          <p className="text-gray-600 mt-2">Review and manage customer complaints.</p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Customer Complaints</h3>
        </div>

        <AdminComplaintsClient initialComplaints={complaints} />

        {complaints.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="text-gray-500">No complaints found.</div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Complaints Management</h3>
        <div className="text-blue-800 text-sm space-y-1">
          <p>• Review customer complaints and provide appropriate responses.</p>
          <p>• Update complaint status as OPEN, CLOSED, or ACCEPTED.</p>
          <p>• Add admin decisions for resolved complaints.</p>
          <p>• All status changes are tracked with timestamps.</p>
        </div>
      </div>
    </div>
  );
}