import { redirect } from 'next/navigation';
import { getUserFromCookie } from '@/lib/auth';

export default async function PartnerDashboard() {
  const user = await getUserFromCookie();

  if (!user || user.type !== 'partner') {
    redirect('/login');
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Partner Company Dashboard</h1>

      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Welcome, {(user as any).comName}</h2>
          <p className="text-gray-600">
            Your partner dashboard is under development. More features will be added soon.
          </p>
        </div>

        {/* Placeholder for future features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Vehicles</h3>
            <p className="text-sm text-gray-600">Manage your company vehicles</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Drivers</h3>
            <p className="text-sm text-gray-600">Manage your drivers</p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold">Reports</h3>
            <p className="text-sm text-gray-600">View earnings and reports</p>
          </div>
        </div>
      </div>
    </div>
  );
}