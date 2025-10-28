"use client";
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Simple dashboard without charts for now - focus on core functionality

const fetcher = (url:string)=> fetch(url,{cache:'no-store'}).then(r=>r.json());

function ActionBtn({id, action, label, icon}:{id:number, action:string, label:string, icon?:string}){
  async function go(){
    await fetch('/api/admin/bookings/update',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, action }) });
    location.reload();
  }
  return <button onClick={go} className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all duration-200 flex items-center gap-1">{icon}{label}</button>;
}

function TabBtn({active,label,onClick}:{active:boolean,label:string,onClick:()=>void}){
  return <button onClick={onClick} className={`px-4 py-2 rounded-2xl border font-medium transition-all duration-200 ${active? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg':'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-md'}`} suppressHydrationWarning>{label}</button>;
}

export default function AdminBookings(){
  const { data } = useSWR('/api/admin/bookings',{ fetcher });
  const rides = (data?.rides||[]) as any[];

  // State for filtering and bulk operations
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);

  const groups = {
    pending: rides.filter(r=> r.status==='PENDING' && !r.paid),
    paid: rides.filter(r=> r.status==='PAID'),
    processing: rides.filter(r=> r.status==='PROGRESSING'),
    confirmedActive: rides.filter(r=> (r.status==='CONFIRMED' || r.status==='DISPATCHED' || r.status==='ONGOING')),
    completed: rides.filter(r=> r.status==='COMPLETED'),
    canceled: rides.filter(r=> r.status==='CANCELED'),
  } as const;

  // Filter rides based on search and date
  const filterRides = (rides: any[]) => {
    return rides.filter(ride => {
      // Search filter
      const matchesSearch = !searchTerm ||
        ride.id.toString().includes(searchTerm) ||
        ride.user?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ride.user?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ride.pickupAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ride.dropoffAddress?.toLowerCase().includes(searchTerm.toLowerCase());

      // Date filter
      const rideDate = new Date(ride.createdAt);
      const today = new Date();
      const matchesDate = dateFilter === 'all' ||
        (dateFilter === 'today' && rideDate.toDateString() === today.toDateString()) ||
        (dateFilter === 'week' && rideDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) ||
        (dateFilter === 'month' && rideDate.getMonth() === today.getMonth() && rideDate.getFullYear() === today.getFullYear());

      return matchesSearch && matchesDate;
    });
  };

  const tabs = [
    {key:'pending', label:`Awaiting confirmation (${filterRides(groups.pending).length})`},
    {key:'paid', label:`Paid - awaiting confirmation (${filterRides(groups.paid).length})`},
    {key:'processing', label:`Processing (${filterRides(groups.processing).length})`},
    {key:'confirmedActive', label:`Confirmed / not finished (${filterRides(groups.confirmedActive).length})`},
    {key:'completed', label:`Completed (${filterRides(groups.completed).length})`},
    {key:'canceled', label:`Canceled (${filterRides(groups.canceled).length})`}
  ] as const;

  // Use proper React state for tab management
  const [currentTab, setCurrentTab] = useState<keyof typeof groups>('pending');

  // Filtered list for current tab
  const filteredList = filterRides(groups[currentTab]);

  // Export to CSV function
  const exportToCSV = () => {
    const headers = ['ID', 'User', 'Pickup Address', 'Dropoff Address', 'Time', 'Price', 'Status', 'Paid'];
    const csvData = filteredList.map(ride => [
      ride.id,
      `${ride.user?.firstName} ${ride.user?.lastName}`,
      ride.pickupAddress,
      ride.dropoffAddress,
      new Date(ride.pickupTime).toLocaleString(),
      ride.price,
      ride.status,
      ride.paid ? 'Yes' : 'No'
    ]);

    const csvContent = [headers, ...csvData].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${currentTab}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? location.hash?.slice(1) : '';
    const validTab = hash && groups[hash as keyof typeof groups] ? hash as keyof typeof groups : 'pending';
    setCurrentTab(validTab);
  }, [data]);

  function switchTab(k: keyof typeof groups){
    setCurrentTab(k);
    if (typeof window !== 'undefined') {
      location.hash = k;
    }
  }

  // Bulk operations
  const handleBulkAction = async (action: string) => {
    if (selectedBookings.length === 0) return;

    if (!confirm(`Are you sure you want to ${action.toLowerCase()} ${selectedBookings.length} booking(s)?`)) return;

    try {
      for (const id of selectedBookings) {
        await fetch('/api/admin/bookings/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action })
        });
      }
      setSelectedBookings([]);
      location.reload();
    } catch (error) {
      alert('Error performing bulk action');
    }
  };

  // Calculate statistics for dashboard
  const stats = {
    total: rides.length,
    pending: groups.pending.length,
    paid: groups.paid.length,
    processing: groups.processing.length,
    confirmedActive: groups.confirmedActive.length,
    completed: groups.completed.length,
    canceled: groups.canceled.length,
    totalRevenue: rides.filter(r => r.paid).reduce((sum, r) => sum + (r.price || 0), 0),
    todayBookings: rides.filter(r => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today;
    }).length
  };

  // Chart data
  const statusData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Paid', value: stats.paid, color: '#3b82f6' },
    { name: 'Processing', value: stats.processing, color: '#8b5cf6' },
    { name: 'Active', value: stats.confirmedActive, color: '#06b6d4' },
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Canceled', value: stats.canceled, color: '#ef4444' }
  ];

  return (
    <div className="grid gap-8">
      {/* Dashboard Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">📊 Booking Management</h1>
        <p className="text-slate-600">Manage and track all customer bookings</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-feature text-center">
          <div className="text-2xl font-bold text-cyan-600">{stats.total}</div>
          <div className="text-sm text-slate-600">Total Bookings</div>
        </div>
        <div className="card-feature text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.todayBookings}</div>
          <div className="text-sm text-slate-600">Today</div>
        </div>
        <div className="card-feature text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalRevenue} DKK</div>
          <div className="text-sm text-slate-600">Total Revenue</div>
        </div>
        <div className="card-feature text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.confirmedActive}</div>
          <div className="text-sm text-slate-600">Active Rides</div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="card-feature">
        <h3 className="text-lg font-semibold mb-4 text-center">📈 Booking Status Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statusData.map((status, index) => (
            <div key={status.name} className="text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: status.color }}
              >
                {status.value}
              </div>
              <div className="text-sm font-medium text-slate-700">{status.name}</div>
              <div className="text-xs text-slate-500">
                {stats.total > 0 ? ((status.value / stats.total) * 100).toFixed(1) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedBookings.length > 0 && (
        <div className="card-feature bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedBookings.length} booking(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('CONFIRM')}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                ✅ Confirm Selected
              </button>
              <button
                onClick={() => handleBulkAction('CANCEL')}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                ❌ Cancel Selected
              </button>
              <button
                onClick={() => handleBulkAction('MARK_PAID')}
                className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm"
              >
                💳 Mark Paid
              </button>
              <button
                onClick={() => setSelectedBookings([])}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                ✕ Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3 justify-center">
        {tabs.map(t=> (
          <TabBtn key={t.key} active={currentTab===t.key} label={t.label} onClick={()=>switchTab(t.key as any)} />
        ))}
      </div>
      {/* Search and Filter Bar */}
      <div className="card-feature">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="🔍 Search by user, address, or ID..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              📊 Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 text-left">
                <th className="p-4 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedBookings.length === filteredList.length && filteredList.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBookings(filteredList.map(r => r.id));
                      } else {
                        setSelectedBookings([]);
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="p-4 font-semibold text-slate-700">#</th>
                <th className="p-4 font-semibold text-slate-700">👤 User</th>
                <th className="p-4 font-semibold text-slate-700">📍 Pickup</th>
                <th className="p-4 font-semibold text-slate-700">🎯 Dropoff</th>
                <th className="p-4 font-semibold text-slate-700">🕐 Time</th>
                <th className="p-4 font-semibold text-slate-700">💰 Price</th>
                <th className="p-4 font-semibold text-slate-700">📊 Status</th>
                <th className="p-4 font-semibold text-slate-700">💳 Paid</th>
                <th className="p-4 font-semibold text-slate-700">⚡ Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r:any)=> (
                 <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors duration-150">
                   <td className="p-4">
                     <input
                       type="checkbox"
                       checked={selectedBookings.includes(r.id)}
                       onChange={(e) => {
                         if (e.target.checked) {
                           setSelectedBookings([...selectedBookings, r.id]);
                         } else {
                           setSelectedBookings(selectedBookings.filter(id => id !== r.id));
                         }
                       }}
                       className="rounded"
                     />
                   </td>
                   <td className="p-4 font-medium text-slate-800">{r.id}</td>
                   <td className="p-4 text-slate-700">{r.user?.firstName} {r.user?.lastName}</td>
                   <td className="p-4 text-slate-600 max-w-xs truncate" title={r.pickupAddress}>{r.pickupAddress}</td>
                   <td className="p-4 text-slate-600 max-w-xs truncate" title={r.dropoffAddress}>{r.dropoffAddress}</td>
                   <td className="p-4 text-slate-600">{new Date(r.pickupTime).toLocaleString()}</td>
                   <td className="p-4 font-semibold text-emerald-600">{r.price} DKK</td>
                   <td className="p-4">
                     <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                       r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                       r.status === 'CANCELED' ? 'bg-red-100 text-red-800' :
                       r.status === 'PROGRESSING' ? 'bg-blue-100 text-blue-800' :
                       r.status === 'CONFIRMED' ? 'bg-cyan-100 text-cyan-800' :
                       'bg-slate-100 text-slate-800'
                     }`}>
                       {r.status}
                     </span>
                   </td>
                   <td className="p-4">
                     {r.paid ? (
                       <span className="text-emerald-600 font-medium">✅ Yes</span>
                     ) : (
                       <span className="text-slate-500">❌ No</span>
                     )}
                   </td>
                   <td className="p-4">
                     <div className="flex gap-2 flex-wrap">
                       {r.status==='PENDING' && <ActionBtn id={r.id} action="CONFIRM" label="Confirm" icon="✅" />}
                       {r.status==='PAID' && <ActionBtn id={r.id} action="PROCESS" label="Process" icon="⚙️" />}
                       {r.status==='PROGRESSING' && <ActionBtn id={r.id} action="CONFIRM_BOOKING" label="Confirm" icon="✅" />}
                       {(r.status==='CONFIRMED') && <ActionBtn id={r.id} action="DISPATCH" label="Dispatch" icon="🚗" />}
                       {(r.status==='DISPATCHED') && <ActionBtn id={r.id} action="START" label="Start" icon="▶️" />}
                       {(r.status==='ONGOING') && <ActionBtn id={r.id} action="COMPLETE" label="Complete" icon="🏁" />}
                       {r.status!=='CANCELED' && r.status!=='COMPLETED' && <ActionBtn id={r.id} action="CANCEL" label="Cancel" icon="❌" />}
                       {!r.paid && <ActionBtn id={r.id} action="MARK_PAID" label="Mark Paid" icon="💳" />}
                     </div>
                   </td>
                 </tr>
               ))}
              {filteredList.length===0 && (
                <tr><td colSpan={10} className="p-8 text-center text-slate-500">
                  <div className="text-4xl mb-2">📭</div>
                  <div className="font-medium">No bookings match your filters</div>
                  <div className="text-sm mt-1">Try adjusting your search or date filters</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
