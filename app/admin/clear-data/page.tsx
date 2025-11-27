import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import ClearDataClient from '@/components/clear-data-client';
import { ArrowLeft } from 'lucide-react';

export default async function ClearDataPage(){
  const me = await getUserFromCookie();
  if (!me || me.type !== 'user' || (me as any).role !== 'ADMIN'){
    return (
      <div className="max-w-xl mx-auto grid gap-4">
        <h1 className="text-3xl font-bold">Clear Database Data</h1>
        <div className="border rounded-2xl p-4 bg-yellow-50 text-yellow-900">
          <div className="font-semibold">Access restricted</div>
          <div className="text-sm mt-1">You must be an administrator to view this page.</div>
          <div className="mt-3"><Link href="/" className="underline">Go back home</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clear Data</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and clear database records.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      <ClearDataClient />
    </div>
  );
}