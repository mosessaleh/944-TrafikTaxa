import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';

export default async function AdminHome(){
  const me = await getUserFromCookie();
  if (!me || me.role !== 'ADMIN'){
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

  // Comprehensive statistics
  const [
    totalBookings,
    pendingBookings,
    confirmedBookings,
    ongoingBookings,
    completedBookings,
    canceledBookings,
    refundingBookings,
    refundedBookings,
    unpaidBookings,
    totalUsers,
    activeUsers,
    totalRevenue,
    todayRevenue,
    thisWeekRevenue,
    thisMonthRevenue,
    cryptoPayments,
    cardPayments,
    paypalPayments,
    revolutPayments,
    totalVehicles,
    activeVehicles
  ] = await Promise.all([
    // Bookings statistics
    prisma.ride.count(),
    prisma.ride.count({ where: { status: 'PENDING' } }),
    prisma.ride.count({ where: { status: 'CONFIRMED' } }),
    prisma.ride.count({ where: { status: 'ONGOING' } }),
    prisma.ride.count({ where: { status: 'COMPLETED' } }),
    prisma.ride.count({ where: { status: 'CANCELED' } }),
    prisma.ride.count({ where: { status: 'REFUNDING' as any } }),
    prisma.ride.count({ where: { status: 'REFUNDED' as any } }),
    prisma.ride.count({ where: { status: 'PENDING' } }),

    // Users statistics
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),

    // Revenue statistics
    prisma.ride.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { price: true }
    }),
    prisma.ride.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      },
      _sum: { price: true }
    }),
    prisma.ride.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      _sum: { price: true }
    }),
    prisma.ride.aggregate({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: { price: true }
    }),

    // Payment methods
    prisma.cryptoPayment.count(),
    prisma.cardPayment.count(),
    prisma.payPalPayment.count(),
    prisma.revolutPayment.count(),

    // Vehicles
    prisma.vehicleType.count(),
    prisma.vehicleType.count({ where: { active: true } })
  ]);

  const stats = {
    bookings: {
      total: totalBookings,
      pending: pendingBookings,
      confirmed: confirmedBookings,
      ongoing: ongoingBookings,
      completed: completedBookings,
      canceled: canceledBookings,
      refunding: refundingBookings,
      refunded: refundedBookings,
      unpaid: unpaidBookings
    },
    users: {
      total: totalUsers,
      active: activeUsers
    },
    revenue: {
      total: totalRevenue._sum.price || 0,
      today: todayRevenue._sum.price || 0,
      thisWeek: thisWeekRevenue._sum.price || 0,
      thisMonth: thisMonthRevenue._sum.price || 0
    },
    payments: {
      crypto: cryptoPayments,
      card: cardPayments,
      paypal: paypalPayments,
      revolut: revolutPayments
    },
    vehicles: {
      total: totalVehicles,
      active: activeVehicles
    }
  };

  return (
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back, {me.firstName}! Here's what's happening with your business.</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Last updated</div>
          <div className="font-medium">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-100 text-sm font-medium">Total Revenue</div>
              <div className="text-3xl font-bold">{stats.revenue.total} DKK</div>
            </div>
            <div className="text-4xl opacity-80">💰</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-green-100 text-sm font-medium">Active Bookings</div>
              <div className="text-3xl font-bold">{stats.bookings.confirmed + stats.bookings.ongoing}</div>
            </div>
            <div className="text-4xl opacity-80">🚗</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-purple-100 text-sm font-medium">Total Users</div>
              <div className="text-3xl font-bold">{stats.users.total}</div>
            </div>
            <div className="text-4xl opacity-80">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-orange-100 text-sm font-medium">Completion Rate</div>
              <div className="text-3xl font-bold">
                {stats.bookings.total > 0 ? Math.round((stats.bookings.completed / stats.bookings.total) * 100) : 0}%
              </div>
            </div>
            <div className="text-4xl opacity-80">📊</div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bookings Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Bookings Overview</h3>
          <div className="space-y-3">
            {[
              { label: 'Total Bookings', value: stats.bookings.total, color: 'text-gray-900' },
              { label: 'Pending Confirmation', value: stats.bookings.pending, color: 'text-yellow-600' },
              { label: 'Confirmed', value: stats.bookings.confirmed, color: 'text-blue-600' },
              { label: 'In Progress', value: stats.bookings.ongoing, color: 'text-cyan-600' },
              { label: 'Completed', value: stats.bookings.completed, color: 'text-green-600' },
              { label: 'Canceled', value: stats.bookings.canceled, color: 'text-red-600' },
              { label: 'Refunding', value: stats.bookings.refunding, color: 'text-orange-600' },
              { label: 'Refunded', value: stats.bookings.refunded, color: 'text-purple-600' },
              { label: 'Unpaid', value: stats.bookings.unpaid, color: 'text-red-500' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-semibold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Revenue Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: 'Today', value: stats.revenue.today, color: 'text-green-600' },
              { label: 'This Week', value: stats.revenue.thisWeek, color: 'text-blue-600' },
              { label: 'This Month', value: stats.revenue.thisMonth, color: 'text-purple-600' },
              { label: 'All Time', value: stats.revenue.total, color: 'text-gray-900' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-semibold ${item.color}`}>{item.value} DKK</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {[
              { label: 'Crypto Payments', value: stats.payments.crypto, icon: '₿' },
              { label: 'Card Payments', value: stats.payments.card, icon: '💳' },
              { label: 'PayPal Payments', value: stats.payments.paypal, icon: '🅿️' },
              { label: 'Revolut Payments', value: stats.payments.revolut, icon: '🔄' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-gray-600 flex items-center gap-2">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">System Overview</h3>
          <div className="space-y-3">
            {[
              { label: 'Total Users', value: stats.users.total, icon: '👥' },
              { label: 'Active Users', value: stats.users.active, icon: '✅' },
              { label: 'Total Vehicles', value: stats.vehicles.total, icon: '🚗' },
              { label: 'Active Vehicles', value: stats.vehicles.active, icon: '🟢' }
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-gray-600 flex items-center gap-2">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/admin/bookings" className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-2">📋</div>
            <div className="font-medium text-gray-900">Manage Bookings</div>
            <div className="text-sm text-gray-500">View & update rides</div>
          </Link>

          <Link href="/admin/users" className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-2">👥</div>
            <div className="font-medium text-gray-900">User Management</div>
            <div className="text-sm text-gray-500">Manage user accounts</div>
          </Link>

          <Link href="/admin/vehicles" className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-2">🚗</div>
            <div className="font-medium text-gray-900">Vehicle Types</div>
            <div className="text-sm text-gray-500">Configure vehicles</div>
          </Link>

          <Link href="/admin/crypto" className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-2">₿</div>
            <div className="font-medium text-gray-900">Crypto Wallets</div>
            <div className="text-sm text-gray-500">Manage payments</div>
          </Link>

          <Link href="/admin/payments" className="flex flex-col items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-2">💳</div>
            <div className="font-medium text-gray-900">Payment Methods</div>
            <div className="text-sm text-gray-500">Configure payment options</div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h3>
        <div className="text-gray-600">
          <p>Dashboard overview with comprehensive statistics and quick access to all admin functions.</p>
          <p className="mt-2">Use the navigation tabs above to access detailed management sections.</p>
        </div>
      </div>
    </div>
  );
}
