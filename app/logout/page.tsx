"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage(){
  const [loggedOut, setLoggedOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user came from logout button
    const logoutIntent = sessionStorage.getItem('logoutIntent');
    if (logoutIntent !== 'true') {
      // Direct access, redirect to home
      router.push('/');
      return;
    }

    // Remove the flag
    sessionStorage.removeItem('logoutIntent');

    // Call logout API
    fetch('/api/auth/logout', { method: 'POST' })
      .then(() => {
        setLoggedOut(true);
      })
      .catch(() => {
        setLoggedOut(true); // Even if error, consider logged out
      });
  }, [router]);

  if (!loggedOut) {
    return (
      <div className="max-w-2xl mx-auto grid gap-6 py-12">
        <div className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h1 className="text-2xl font-bold mb-4">Logging out...</h1>
          <p className="text-gray-600">
            Please wait while we log you out.
          </p>
        </div>
      </div>
    );
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