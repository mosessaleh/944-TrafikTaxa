import dynamic from 'next/dynamic';

const AccountClient = dynamic(() => import("@/components/account-client"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading account...</p>
        </div>
      </div>
    </div>
  )
});

export default function AccountPage() {
  return <AccountClient />;
}
