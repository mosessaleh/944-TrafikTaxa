import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import ClearDataClient from '@/components/clear-data-client';

export default async function ClearDataPage(){
  const me = await getUserFromCookie();
  if (!me || me.role !== 'ADMIN'){
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

  return <ClearDataClient />;
}