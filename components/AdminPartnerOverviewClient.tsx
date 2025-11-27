"use client";

import { useState, useEffect } from "react";
import {
  Building,
  Users,
  Car,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  MapPin,
} from 'lucide-react';

interface PartnerStats {
  totalCompanies: number;
  activeCompanies: number;
  totalVehicles: number;
  totalDrivers: number;
  totalRevenue: number;
  monthlyGrowth: number;
}

interface PartnerCompany {
  id: number;
  comName: string;
  comStatus: boolean;
  contractSigned: boolean;
  commissionRate: number;
  createdAt: string;
  _count: {
    vehicles: number;
    drivers: number;
  };
}

export function AdminPartnerOverviewClient() {
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [companies, setCompanies] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch companies with counts
      const companiesRes = await fetch('/api/admin/partners/companies');
      if (!companiesRes.ok) throw new Error('Failed to fetch companies');
      const companiesData = await companiesRes.json();

      if (companiesData.ok) {
        setCompanies(companiesData.data);
      }

      // Calculate stats
      const totalCompanies = companiesData.data?.length || 0;
      const activeCompanies = companiesData.data?.filter((c: any) => c.comStatus).length || 0;
      const totalVehicles = companiesData.data?.reduce((sum: number, c: any) => sum + (c._count?.vehicles || 0), 0) || 0;
      const totalDrivers = companiesData.data?.reduce((sum: number, c: any) => sum + (c._count?.drivers || 0), 0) || 0;

      // Mock additional stats (in real app, these would come from APIs)
      const totalRevenue = totalCompanies * 15000; // Mock revenue
      const monthlyGrowth = 12.5; // Mock growth

      setStats({
        totalCompanies,
        activeCompanies,
        totalVehicles,
        totalDrivers,
        totalRevenue,
        monthlyGrowth,
      });

    } catch (err: any) {
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-800 font-medium">Error loading overview</span>
        </div>
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Companies</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalCompanies || 0}</p>
            </div>
            <Building className="w-8 h-8 text-blue-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600">{stats?.activeCompanies || 0} active</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalVehicles || 0}</p>
            </div>
            <Car className="w-8 h-8 text-green-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-blue-500 mr-1" />
            <span className="text-blue-600">+{stats?.monthlyGrowth || 0}% this month</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Drivers</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalDrivers || 0}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Activity className="w-4 h-4 text-orange-500 mr-1" />
            <span className="text-orange-600">Active drivers</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900">DKK {stats?.totalRevenue?.toLocaleString() || 0}</p>
            </div>
            <DollarSign className="w-8 h-8 text-emerald-500" />
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            <span className="text-green-600">+{stats?.monthlyGrowth || 0}% growth</span>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Status Overview */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <PieChart className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Company Status</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Active Companies</span>
              </div>
              <span className="font-semibold">{stats?.activeCompanies || 0}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span className="text-sm text-gray-600">Inactive Companies</span>
              </div>
              <span className="font-semibold">{(stats?.totalCompanies || 0) - (stats?.activeCompanies || 0)}</span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Contract Signed</span>
              <span className="font-semibold">
                {companies.filter(c => c.contractSigned).length}/{companies.length}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Companies */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Recent Companies</h3>
          </div>

          <div className="space-y-4">
            {companies.slice(0, 5).map((company) => (
              <div key={company.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Building className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{company.comName}</p>
                    <p className="text-xs text-gray-500">
                      {company._count.vehicles} vehicles • {company._count.drivers} drivers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {company.comStatus ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  {company.contractSigned && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" title="Contract Signed"></div>
                  )}
                </div>
              </div>
            ))}

            {companies.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No companies found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Companies */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Companies</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr className="text-left">
                <th className="pb-3 font-medium text-gray-600">Company</th>
                <th className="pb-3 font-medium text-gray-600">Status</th>
                <th className="pb-3 font-medium text-gray-600">Vehicles</th>
                <th className="pb-3 font-medium text-gray-600">Drivers</th>
                <th className="pb-3 font-medium text-gray-600">Commission</th>
                <th className="pb-3 font-medium text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.slice(0, 10).map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Building className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-900">{company.comName}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    {company.comStatus ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        <CheckCircle size={10} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                        <XCircle size={10} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-medium">{company._count.vehicles}</span>
                  </td>
                  <td className="py-3 text-center">
                    <span className="font-medium">{company._count.drivers}</span>
                  </td>
                  <td className="py-3">
                    <span className="font-medium">{company.commissionRate}%</span>
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No company data available</p>
          </div>
        )}
      </div>
    </div>
  );
}