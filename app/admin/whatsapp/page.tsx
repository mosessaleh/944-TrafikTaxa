'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, MessageCircle, Phone, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface WAMessage {
  id: number;
  createdAt: string;
  phone: string;
  direction: string;
  type: string;
  content: string;
  status: string;
  rideId: number | null;
  userId: number | null;
  errorMessage: string | null;
}

interface Stats {
  totalInbound: number;
  totalOutbound: number;
  failedCount: number;
  totalCount: number;
}

export default function WhatsAppMessagesPage() {
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [stats, setStats] = useState<Stats>({ totalInbound: 0, totalOutbound: 0, failedCount: 0, totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ direction: '', status: '', type: '', phone: '' });

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (filters.direction) params.set('direction', filters.direction);
      if (filters.status) params.set('status', filters.status);
      if (filters.type) params.set('type', filters.type);
      if (filters.phone) params.set('phone', filters.phone);

      const res = await fetch(`/api/admin/whatsapp-messages?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages || []);
        setStats(data.stats || { totalInbound: 0, totalOutbound: 0, failedCount: 0, totalCount: 0 });
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Messages</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor all WhatsApp conversations and notifications</p>
        </div>
        <button onClick={fetchMessages} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
          <RefreshCw size={20} className={loading ? 'animate-spin text-blue-500' : 'text-gray-500'} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Messages" value={stats.totalCount} color="blue" />
        <StatCard label="Inbound" value={stats.totalInbound} color="green" icon={<ArrowDownLeft size={16} />} />
        <StatCard label="Outbound" value={stats.totalOutbound} color="purple" icon={<ArrowUpRight size={16} />} />
        <StatCard label="Failed" value={stats.failedCount} color="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          value={filters.direction}
          onChange={e => { setFilters({ ...filters, direction: e.target.value }); setPage(1); }}
        >
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          value={filters.status}
          onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
        >
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          value={filters.type}
          onChange={e => { setFilters({ ...filters, type: e.target.value }); setPage(1); }}
        >
          <option value="">All Types</option>
          <option value="text">Text</option>
          <option value="template">Template</option>
          <option value="interactive">Interactive</option>
          <option value="notification">Notification</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by phone..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            value={filters.phone}
            onChange={e => { setFilters({ ...filters, phone: e.target.value }); setPage(1); }}
          />
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Direction</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Content</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {messages.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No messages found</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
              )}
              {messages.map(msg => (
                <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono">{msg.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${msg.direction === 'inbound' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>
                      {msg.direction === 'inbound' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {msg.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{msg.type}</td>
                  <td className="px-4 py-3 text-sm max-w-md">
                    <div className="truncate" title={msg.content}>{msg.content.substring(0, 100)}{msg.content.length > 100 ? '...' : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${msg.status === 'failed' ? 'bg-red-50 text-red-600' : msg.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">Total: {total} messages</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 text-sm opacity-75 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
