"use client";
import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';

interface AnalyticsData {
  totalComplaints: number;
  openComplaints: number;
  closedComplaints: number;
  overdueComplaints: number;
  categoryBreakdown: { [key: string]: number };
  priorityBreakdown: { [key: string]: number };
  monthlyTrend: { month: string; count: number }[];
  averageResolutionTime: number;
}

export default function ComplaintsAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/complaints/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <p className="text-gray-500">Failed to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <BarChart3 size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{analytics.totalComplaints}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Complaints</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{analytics.openComplaints}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Open Complaints</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{analytics.overdueComplaints}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue SLA</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{analytics.averageResolutionTime}h</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Resolution Time</div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaints by Category</h3>
          <div className="space-y-3">
            {Object.entries(analytics.categoryBreakdown).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 capitalize">{category}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(count / analytics.totalComplaints) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Complaints by Priority</h3>
          <div className="space-y-3">
            {Object.entries(analytics.priorityBreakdown).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <span className={`text-sm font-medium capitalize px-2 py-1 rounded ${
                  priority === 'high' ? 'bg-red-100 text-red-800' :
                  priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {priority}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        priority === 'high' ? 'bg-red-600' :
                        priority === 'medium' ? 'bg-yellow-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${(count / analytics.totalComplaints) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Complaint Trend</h3>
        <div className="flex items-end gap-2 h-32">
          {analytics.monthlyTrend.map((month, index) => (
            <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-blue-600 rounded-t"
                style={{
                  height: `${(month.count / Math.max(...analytics.monthlyTrend.map(m => m.count))) * 100}%`,
                  minHeight: month.count > 0 ? '8px' : '0px'
                }}
              ></div>
              <span className="text-xs text-gray-500">{month.month}</span>
              <span className="text-xs font-medium text-gray-700">{month.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}