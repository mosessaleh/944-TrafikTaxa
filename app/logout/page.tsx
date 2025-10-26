import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Logged Out | 944 Trafik',
  description: 'You have been successfully logged out of 944 Trafik.',
};

export default async function LogoutPage(){
  const user = await getCurrentUser();
  if (user) {
    // If user is still logged in, redirect to logout API
    redirect('/api/auth/logout');
  }

  return (
    <div className="max-w-2xl mx-auto grid gap-6 py-12">
      <div className="text-center">
        <div className="text-6xl mb-4">👋</div>
        <h1 className="text-3xl font-bold mb-4">Logged Out Successfully</h1>
        <p className="text-gray-600 mb-8">
          You have been successfully logged out of your 944 Trafik account.
        </p>
        <div className="flex gap-4 justify-center">
          <a href="/login" className="px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition">
            Login Again
          </a>
          <a href="/" className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition">
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}