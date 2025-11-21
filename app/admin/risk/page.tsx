import { prisma } from '@/lib/db';
import { getUserFromCookie } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Shield, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import RiskManagementClient from '../../../components/RiskManagementClient';

export default async function AdminRiskManagement() {
  const me = await getUserFromCookie();
  if (!me || me.role !== 'ADMIN') {
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

  // Get high-risk bookings (only those that have been risk-assessed)
  // Temporarily disabled until Prisma client is regenerated
  const highRiskBookings: any[] = [];
  /*
  const highRiskBookings = await (prisma as any).ride.findMany({
    where: {
      AND: [
        { riskScore: { not: null } }, // Only bookings that have been assessed
        {
          OR: [
            { riskLevel: 'high' },
            { riskLevel: 'critical' },
            {
              riskLevel: 'medium',
              riskReviewed: false
            }
          ]
        }
      ]
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: [
      { riskScore: 'desc' },
      { createdAt: 'desc' }
    ],
    take: 50
  });
  */

  // Get recent bookings that haven't been risk-assessed yet (for manual assessment)
  // Temporarily disabled until Prisma client is regenerated
  const unassessedBookings: any[] = [];
  /*
  const unassessedBookings = await (prisma as any).ride.findMany({
    where: {
      OR: [
        { riskScore: null },
        { riskScore: 0 }
      ],
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  */

  // Get risk statistics
  const totalBookings = await (prisma as any).ride.count();
  // Temporarily disabled until Prisma client is regenerated
  const highRiskCount = 0;
  const mediumRiskCount = 0;
  const lowRiskCount = 0;
  const reviewedCount = 0;
  const escalatedCount = 0;
  /*
  const highRiskCount = await (prisma as any).ride.count({
    where: {
      OR: [
        { riskLevel: 'high' },
        { riskLevel: 'critical' }
      ]
    }
  });

  const mediumRiskCount = await (prisma as any).ride.count({
    where: { riskLevel: 'medium' }
  });

  const lowRiskCount = await (prisma as any).ride.count({
    where: { riskLevel: 'low' }
  });

  const reviewedCount = await (prisma as any).ride.count({
    where: { riskReviewed: true }
  });

  const escalatedCount = await (prisma as any).ride.count({
    where: { escalated: true }
  });
  */

  // Recent risk trends (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Temporarily disabled until Prisma client is regenerated
  const recentHighRisk = 0;
  /*
  const recentHighRisk = await (prisma as any).ride.count({
    where: {
      createdAt: { gte: sevenDaysAgo },
      OR: [
        { riskLevel: 'high' },
        { riskLevel: 'critical' }
      ]
    }
  });
  */

  // Risk distribution by category
  const rawRiskByCategory = await (prisma as any).$queryRaw`
    SELECT
      COALESCE(riskLevel, 'unassessed') as level,
      COUNT(*) as count,
      AVG(COALESCE(riskScore, 0)) as avgScore
    FROM ride
    GROUP BY riskLevel
    ORDER BY
      CASE
        WHEN riskLevel = 'critical' THEN 1
        WHEN riskLevel = 'high' THEN 2
        WHEN riskLevel = 'medium' THEN 3
        WHEN riskLevel = 'low' THEN 4
        ELSE 5
      END
  `;
  const riskByCategory = (rawRiskByCategory as any[]).map(item => ({
    ...item,
    avgScore: Number(item.avgScore)
  }));

  // Top risk factors
  const rawTopRiskFactors = await (prisma as any).$queryRaw`
    SELECT
      JSON_UNQUOTE(JSON_EXTRACT(factor, '$.type')) as factorType,
      JSON_UNQUOTE(JSON_EXTRACT(factor, '$.description')) as description,
      JSON_UNQUOTE(JSON_EXTRACT(factor, '$.severity')) as severity,
      COUNT(*) as count,
      AVG(JSON_EXTRACT(factor, '$.score')) as avgScore
    FROM ride r
    CROSS JOIN JSON_TABLE(r.riskFactors, '$[*]' COLUMNS (
      factor JSON PATH '$'
    )) factors
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(factor, '$.type')), JSON_UNQUOTE(JSON_EXTRACT(factor, '$.description')), JSON_UNQUOTE(JSON_EXTRACT(factor, '$.severity'))
    ORDER BY count DESC
    LIMIT 10
  `;
  const topRiskFactors = (rawTopRiskFactors as any[]).map(item => ({
    ...item,
    avgScore: Number(item.avgScore)
  }));

  // Risk trends over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rawRiskTrends = await (prisma as any).$queryRaw`
    SELECT
      DATE(createdAt) as date,
      COUNT(*) as totalBookings,
      SUM(CASE WHEN riskLevel IN ('high', 'critical') THEN 1 ELSE 0 END) as highRiskBookings,
      AVG(COALESCE(riskScore, 0)) as avgRiskScore
    FROM ride
    WHERE createdAt >= ${thirtyDaysAgo}
    GROUP BY DATE(createdAt)
    ORDER BY date DESC
  `;
  const riskTrends = (rawRiskTrends as any[]).map(item => ({
    ...item,
    highRiskBookings: Number(item.highRiskBookings),
    avgRiskScore: Number(item.avgRiskScore)
  }));

  const stats = {
    totalBookings,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    reviewedCount,
    escalatedCount,
    recentHighRisk,
    riskByCategory,
    topRiskFactors,
    riskTrends
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Management</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor and manage suspicious bookings automatically.</p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Shield size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalBookings}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Bookings</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.highRiskCount}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">High Risk</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.mediumRiskCount}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Medium Risk</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.reviewedCount}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reviewed</div>
          </div>
        </div>
      </div>

      {/* Risk Management Interface */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <RiskManagementClient initialBookings={highRiskBookings} stats={stats} />
      </div>
    </div>
  );
}