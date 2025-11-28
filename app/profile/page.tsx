import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import ProfileEditClient from '@/components/profile-edit-client';
import PaymentMethodsClient from '@/components/payment-methods-client';
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
  if (u.type !== 'user') return <div>Access denied</div>;
  const user = u as any; // Type assertion since we know it's a user type
  const verifyUrl = `/verify?email=${encodeURIComponent(user.email)}`;
  console.log('User email verified status:', user.emailVerified);
  return (
    <div className="max-w-3xl mx-auto grid gap-6">
      <h1 className="text-3xl font-bold">My Profile</h1>

      {(user.emailVerified === 1 || user.emailVerified === "1") && (
        <div className="grid gap-2 border rounded-xl p-4 bg-orange-50 border-orange-200">
          <div className="font-medium text-orange-800">Email not verified</div>
          <div className="text-sm text-orange-700">Your email <b>{user.email}</b> is not verified. Please verify your email to access all features.</div>
          <Link href={verifyUrl} className="px-4 py-2 rounded-xl border border-orange-300 bg-orange-600 text-white hover:bg-orange-700 transition-colors w-fit">Send verification code</Link>
        </div>
      )}

      <section className="grid gap-4 bg-white border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="grid gap-1">
            <div className="text-sm text-gray-500">Email</div>
            <div className="font-semibold flex items-center gap-2">{user.email} <Badge ok={user.emailVerified === 0 || user.emailVerified === "0"} /></div>
            {(user.emailVerified === 1 || user.emailVerified === "1") && (
              <div className="text-sm text-gray-600">You need to verify your email to book rides or view history. <Link href={verifyUrl} className="underline">Verify now</Link></div>
            )}
          </div>
        </div>
      </section>

      <ProfileEditClient initial={{
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        pendingEmail: user.pendingEmail || null
      }} />

      <PaymentMethodsClient />
    </div>
  );
}
