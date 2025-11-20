import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import { getAdminPath } from '@/lib/admin-route';
import { 
  TrendingUp, 
  Users, 
  Car, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Download,
  Calendar,
  Clock
} from 'lucide-react';

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back, {me.firstName}! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-600 shadow-sm flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                <span>{new Date().toLocaleDateString()}</span>
            </div>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                <Download size={16} />
                <span>Export Report</span>
            </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Total Revenue" 
            value={`${stats.revenue.total.toLocaleString()} DKK`} 
            trend="+12.5%" 
            trendUp={true}
            icon={<TrendingUp size={24} className="text-white" />}
            gradient="from-blue-500 to-blue-600"
        />
        <StatCard 
            title="Active Bookings" 
            value={(stats.bookings.confirmed + stats.bookings.ongoing).toString()} 
            trend="+4.2%" 
            trendUp={true}
            icon={<Car size={24} className="text-white" />}
            gradient="from-emerald-500 to-emerald-600"
        />
        <StatCard 
            title="Total Users" 
            value={stats.users.total.toString()} 
            trend="+2.1%" 
            trendUp={true}
            icon={<Users size={24} className="text-white" />}
            gradient="from-violet-500 to-violet-600"
        />
        <StatCard 
            title="Completion Rate" 
            value={`${stats.bookings.total > 0 ? Math.round((stats.bookings.completed / stats.bookings.total) * 100) : 0}%`} 
            trend="-1.5%" 
            trendUp={false}
            icon={<Clock size={24} className="text-white" />}
            gradient="from-orange-500 to-orange-600"
        />
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bookings Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Bookings Overview</h3>
            <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <StatusCard label="Pending" value={stats.bookings.pending} color="bg-yellow-50 text-yellow-700 border-yellow-100" />
             <StatusCard label="Confirmed" value={stats.bookings.confirmed} color="bg-blue-50 text-blue-700 border-blue-100" />
             <StatusCard label="In Progress" value={stats.bookings.ongoing} color="bg-cyan-50 text-cyan-700 border-cyan-100" />
             <StatusCard label="Completed" value={stats.bookings.completed} color="bg-green-50 text-green-700 border-green-100" />
             <StatusCard label="Canceled" value={stats.bookings.canceled} color="bg-red-50 text-red-700 border-red-100" />
             <StatusCard label="Refunded" value={stats.bookings.refunded} color="bg-purple-50 text-purple-700 border-purple-100" />
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Revenue Breakdown</h3>
            <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <RevenueItem label="Today" value={stats.revenue.today} color="bg-green-500" />
            <RevenueItem label="This Week" value={stats.revenue.thisWeek} color="bg-blue-500" />
            <RevenueItem label="This Month" value={stats.revenue.thisMonth} color="bg-purple-500" />
            <div className="pt-4 border-t border-gray-100 mt-4">
                <div className="flex justify-between items-center">
                    <span className="text-gray-900 font-semibold">Total Revenue</span>
                    <span className="text-xl font-bold text-gray-900">{stats.revenue.total.toLocaleString()} DKK</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Methods */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Payment Methods</h3>
          <div className="space-y-4">
            <PaymentMethodItem label="Crypto Payments" value={stats.payments.crypto} icon="₿" percent={Math.round((stats.payments.crypto / (stats.bookings.total || 1)) * 100)} />
            <PaymentMethodItem label="Card Payments" value={stats.payments.card} icon="💳" percent={Math.round((stats.payments.card / (stats.bookings.total || 1)) * 100)} />
            <PaymentMethodItem label="PayPal Payments" value={stats.payments.paypal} icon="🅿️" percent={Math.round((stats.payments.paypal / (stats.bookings.total || 1)) * 100)} />
            <PaymentMethodItem label="Revolut Payments" value={stats.payments.revolut} icon="🔄" percent={Math.round((stats.payments.revolut / (stats.bookings.total || 1)) * 100)} />
          </div>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">System Overview</h3>
          <div className="grid grid-cols-2 gap-4">
            <SystemStat label="Total Users" value={stats.users.total} icon={<Users size={20} />} color="text-blue-600 bg-blue-50" />
            <SystemStat label="Active Users" value={stats.users.active} icon={<Users size={20} />} color="text-green-600 bg-green-50" />
            <SystemStat label="Total Vehicles" value={stats.vehicles.total} icon={<Car size={20} />} color="text-purple-600 bg-purple-50" />
            <SystemStat label="Active Vehicles" value={stats.vehicles.active} icon={<Car size={20} />} color="text-orange-600 bg-orange-50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon, gradient }: any) {
    return (
        <div className={`rounded-2xl p-6 text-white shadow-lg bg-gradient-to-br ${gradient} relative overflow-hidden`}>
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        {icon}
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm ${trendUp ? 'text-white' : 'text-white'}`}>
                        {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {trend}
                    </div>
                </div>
                <div className="text-white/80 text-sm font-medium mb-1">{title}</div>
                <div className="text-3xl font-bold tracking-tight">{value}</div>
            </div>
        </div>
    )
}

function StatusCard({ label, value, color }: any) {
    return (
        <div className={`p-4 rounded-xl border ${color} flex flex-col items-center justify-center text-center transition-transform hover:scale-[1.02]`}>
            <div className="text-2xl font-bold mb-1">{value}</div>
            <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
        </div>
    )
}

function RevenueItem({ label, value, color }: any) {
    return (
        <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${color}`}></div>
                <span className="text-gray-600 font-medium">{label}</span>
            </div>
            <span className="font-bold text-gray-900">{value.toLocaleString()} DKK</span>
        </div>
    )
}

function PaymentMethodItem({ label, value, icon, percent }: any) {
    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <span>{icon}</span>
                    <span>{label}</span>
                </div>
                <span className="font-bold text-gray-900">{value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    )
}

function SystemStat({ label, value, icon, color }: any) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
            <div className={`p-3 rounded-lg ${color}`}>
                {icon}
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-500">{label}</div>
            </div>
        </div>
    )
}
