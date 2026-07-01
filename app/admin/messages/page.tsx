'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, RefreshCw, Search, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: number;
  rideId: number;
  sender: string;
  message: string;
  timestamp: string;
  source: string;
}

interface RideGroup {
  rideId: number;
  messages: ChatMessage[];
  lastMessage: ChatMessage;
  totalCount: number;
}

export default function MessagesPage() {
  const [rideGroups, setRideGroups] = useState<RideGroup[]>([]);
  const [selectedRide, setSelectedRide] = useState<RideGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchRideId, setSearchRideId] = useState('');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchRideId) params.set('rideId', searchRideId);
      params.set('limit', '2000');

      const res = await fetch(`/api/admin/messages?${params}`);
      const data = await res.json();
      if (data.ok) {
        const msgs: ChatMessage[] = data.messages.reverse(); // oldest first
        const groups: Record<number, ChatMessage[]> = {};
        for (const msg of msgs) {
          if (!groups[msg.rideId]) groups[msg.rideId] = [];
          groups[msg.rideId].push(msg);
        }
        const sorted = Object.entries(groups)
          .map(([rideId, messages]) => ({
            rideId: Number(rideId),
            messages,
            lastMessage: messages[messages.length - 1],
            totalCount: messages.length,
          }))
          .sort((a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime());
        setRideGroups(sorted);
      } else {
        setError(data.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [searchRideId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleClearRide = async (rideId: number) => {
    if (!confirm(`Delete all messages for ride #${rideId}?`)) return;
    try {
      const res = await fetch(`/api/admin/messages?rideId=${rideId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setRideGroups(prev => prev.filter(g => g.rideId !== rideId));
        if (selectedRide?.rideId === rideId) setSelectedRide(null);
        setSuccessMsg(data.message);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(data.error || 'Failed');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Delete ALL chat messages? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/admin/messages', { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        setRideGroups([]);
        setSelectedRide(null);
        setSuccessMsg(data.message);
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(data.error || 'Failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chat Messages</h1>
          <p className="text-sm text-gray-500 mt-1">{rideGroups.length} ride conversations</p>
        </div>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">{successMsg}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="number"
            placeholder="Filter by Ride ID"
            value={searchRideId}
            onChange={e => setSearchRideId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={fetchMessages}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          Loading...
        </div>
      ) : rideGroups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
          No messages found
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ride</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Message</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Messages</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Activity</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rideGroups.map(group => (
                <tr
                  key={group.rideId}
                  onClick={() => setSelectedRide(group)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                      <MessageSquare size={14} />
                      #{group.rideId}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-md">
                      <p className="text-sm text-gray-900 truncate">{group.lastMessage.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        from {group.lastMessage.sender === 'rider' ? 'Rider' : group.lastMessage.sender}
                        {' · '}
                        <span className={group.lastMessage.source === 'whatsapp' ? 'text-purple-500' : 'text-green-500'}>
                          {group.lastMessage.source}
                        </span>
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{group.totalCount}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(group.lastMessage.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); handleClearRide(group.rideId); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete this conversation"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chat Modal */}
      {selectedRide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRide(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold">Ride #{selectedRide.rideId}</h2>
                <p className="text-sm text-gray-500">{selectedRide.totalCount} messages</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleClearRide(selectedRide.rideId)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete conversation"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setSelectedRide(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {selectedRide.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'rider' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    msg.sender === 'rider'
                      ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <div className={`flex items-center gap-2 mt-1 ${
                      msg.sender === 'rider' ? 'justify-start' : 'justify-end'
                    }`}>
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${
                        msg.source === 'whatsapp'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {msg.source}
                      </span>
                      <span className={`text-[10px] ${
                        msg.sender === 'rider' ? 'text-gray-400' : 'text-blue-200'
                      }`}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
