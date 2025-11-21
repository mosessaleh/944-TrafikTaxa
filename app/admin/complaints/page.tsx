"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminComplaintsClient from '@/components/AdminComplaintsClient';
import ComplaintsAnalytics from '@/components/ComplaintsAnalytics';
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle, User, BarChart3, List, TrendingUp } from 'lucide-react';

export default function AdminComplaints() {
  const [activeTab, setActiveTab] = useState<'complaints' | 'analytics'>('complaints');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      setError(null);
      // Fetch complaints data - this will fail if not authorized
      const response = await fetch('/api/admin/complaints');
      if (response.ok) {
        const data = await response.json();
        setComplaints(data.complaints || []);
        setAuthorized(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(`Error ${response.status}: ${errorData.error || 'Unknown error'}`);
        setAuthorized(false);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('Network error occurred');
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  // Calculate SLA statistics
  const now = new Date();
  const overdueComplaints = complaints.filter((c: any) =>
    c.slaDeadline && new Date(c.slaDeadline) < now && c.status === 'OPEN'
  ).length;

  const highPriorityOpen = complaints.filter((c: any) =>
    c.priority === 'high' && c.status === 'OPEN'
  ).length;

  const escalatedComplaints = complaints.filter((c: any) => c.escalated).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Complaints Management</h1>
            <p className="text-gray-500 text-sm mt-1">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints Management</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage customer complaints with automated solutions.</p>
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
            <MessageSquare size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{complaints.length}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Complaints</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-yellow-50 flex items-center justify-center text-yellow-600">
            <AlertCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{overdueComplaints}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue SLA</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{highPriorityOpen}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">High Priority Open</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
            <User size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{escalatedComplaints}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Escalated</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100">
          <div className="flex">
            <button
              onClick={() => setActiveTab('complaints')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'complaints'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <List size={16} />
              Complaints List
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp size={16} />
              Analytics
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'complaints' ? (
            <AdminComplaintsClient initialComplaints={complaints} />
          ) : (
            <ComplaintsAnalytics />
          )}
        </div>
      </div>
    </div>
  );
}