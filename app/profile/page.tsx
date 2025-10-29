import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import ProfileEditClient from '@/components/profile-edit-client';
import ProfileBookings from '@/components/profile-bookings';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Profile | 944 Trafik',
  description: 'Manage your profile and account settings with 944 Trafik.',
  openGraph: {
    title: 'My Profile | 944 Trafik',
    description: 'Manage your profile and account settings with 944 Trafik.',
    images: [{ url: '/logo.svg' }],
  },
};

function Badge({ ok }: { ok: boolean }){
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${ok? 'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>
      {ok? 'Verified':'Unverified'}
    </span>
  );
}

export default async function ProfilePage(){
  const u = await getUserFromCookie();
  if (!u) return <div>Unauthorized</div>;
  const verifyUrl = `/verify?email=${encodeURIComponent(u.email)}`;

  return (
    <div className="max-w-3xl mx-auto grid gap-6">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <section className="grid gap-4 bg-white border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="grid gap-1">
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-semibold flex items-center gap-2">{u.email} <Badge ok={u.emailVerified} /></div>
            {!u.emailVerified && (
              <div className="text-sm text-gray-600">You need to verify your email to book rides or view history. <Link href={verifyUrl} className="underline">Verify now</Link></div>
            )}
          </div>
        </div>
      </section>

      <ProfileEditClient initial={{
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        address: u.address,
        pendingEmail: u.pendingEmail || null
      }} />

      <section className="grid gap-4 bg-white border rounded-2xl p-6">
        <ProfileBookings />
      </section>
    </div>
  );
}
