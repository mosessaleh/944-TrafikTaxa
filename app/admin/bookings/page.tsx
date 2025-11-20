"use client";
import useSWR from 'swr';
import { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Download, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  MapPin,
  User,
  MoreVertical,
  Trash2,
  RefreshCw
} from 'lucide-react';

const fetcher = (url:string)=> fetch(url,{cache:'no-store'}).then(r=>r.json());

function TabBtn({active,label,count,onClick}:{active:boolean,label:string,count:number,onClick:()=>void}){
  return (
    <button 
        onClick={onClick} 
        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
            active
            ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
        }`}
    >
        {label}
        <span className={`px-1.5 py-0.5 rounded-md text-xs ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {count}
        </span>
    </button>
  );
}

export default function AdminBookings(){
  const { data } = useSWR('/api/admin/bookings',{ fetcher });
  const rides = (data?.rides||[]) as any[];

  // State for filtering and bulk operations
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedBookings, setSelectedBookings] = useState<number[]>([]);

  const groups = {
    pending: rides.filter(r=> r.status==='PENDING' && r.paymentStatus!=='PAID'),
    paid: rides.filter(r=> r.paymentStatus==='PAID'),
    processing: rides.filter(r=> r.status==='PROGRESSING'),
    confirmedActive: rides.filter(r=> (r.status==='CONFIRMED' || r.status==='DISPATCHED' || r.status==='ONGOING')),
    completed: rides.filter(r=> r.status==='COMPLETED'),
    canceled: rides.filter(r=> r.status==='CANCELED'),
    refunding: rides.filter(r=> r.status==='REFUNDING'),
    refunded: rides.filter(r=> r.status==='REFUNDED'),
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
    {key:'pending', label:'Pending'},
    {key:'paid', label:'Paid'},
    {key:'processing', label:'Processing'},
    {key:'confirmedActive', label:'Active'},
    {key:'completed', label:'Completed'},
    {key:'canceled', label:'Canceled'},
    {key:'refunding', label:'Refunding'},
    {key:'refunded', label:'Refunded'}
  ] as const;

  // Use proper React state for tab management
  const [currentTab, setCurrentTab] = useState<keyof typeof groups>('pending');

  // Filtered list for current tab
  const filteredList = filterRides(groups[currentTab]);

  // Export to CSV function
  const exportToCSV = () => {
    const headers = ['ID', 'User', 'Pickup Address', 'Dropoff Address', 'Time', 'Price', 'Status', 'Payment Status', 'Payment Method', 'Explanation'];
    const csvData = filteredList.map(ride => [
      ride.id,
      `${ride.user?.firstName} ${ride.user?.lastName}`,
      ride.pickupAddress,
      ride.dropoffAddress,
      new Date(ride.pickupTime).toLocaleString(),
      ride.price,
      ride.status,
      ride.paymentStatus,
      ride.paymentMethod || 'N/A',
      ride.explanation
    ]);

    if (typeof window !== 'undefined') {
      const csvContent = [headers, ...csvData].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bookings-${currentTab}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash?.slice(1) : '';
    const validTab = hash && groups[hash as keyof typeof groups] ? hash as keyof typeof groups : 'pending';
    setCurrentTab(validTab);
  }, [data]);

  function switchTab(k: keyof typeof groups){
    setCurrentTab(k);
    if (typeof window !== 'undefined') {
      window.location.hash = k;
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
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      alert('Error performing bulk action');
    }
  };

  // Calculate statistics for dashboard
  const stats = {
    total: rides.length,
    totalRevenue: rides.filter(r => r.paymentStatus === 'PAID').reduce((sum, r) => sum + (r.price || 0), 0),
    todayBookings: rides.filter(r => {
      const today = new Date().toDateString();
      return new Date(r.createdAt).toDateString() === today;
    }).length,
    activeRides: groups.confirmedActive.length
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
            <p className="text-gray-500 text-sm mt-1">Manage and track all ride bookings.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={exportToCSV} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
                <Download size={16} />
                Export CSV
            </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={stats.total} icon={<Clock size={20} />} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Today's Bookings" value={stats.todayBookings} icon={<Calendar size={20} />} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Total Revenue" value={`${stats.totalRevenue} DKK`} icon={<CreditCard size={20} />} color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Active Rides" value={stats.activeRides} icon={<CheckCircle size={20} />} color="text-orange-600" bg="bg-orange-50" />
      </div>

      {/* Bulk Actions Bar */}
      {selectedBookings.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-blue-800 font-medium">
            <CheckCircle size={18} />
            <span>{selectedBookings.length} booking(s) selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <BulkActionButton onClick={() => handleBulkAction('CONFIRM')} label="Confirm" icon={<CheckCircle size={14} />} color="bg-green-600 hover:bg-green-700" />
            <BulkActionButton onClick={() => handleBulkAction('CANCEL')} label="Cancel" icon={<XCircle size={14} />} color="bg-red-600 hover:bg-red-700" />
            <BulkActionButton onClick={() => handleBulkAction('MARK_PAID')} label="Mark Paid" icon={<CreditCard size={14} />} color="bg-emerald-600 hover:bg-emerald-700" />
            <button
                onClick={() => setSelectedBookings([])}
                className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
                Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        
        {/* Filters & Search */}
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-50/50">
            
            {/* Tabs */}
            <div className="flex overflow-x-auto pb-2 lg:pb-0 gap-2 w-full lg:w-auto no-scrollbar">
                {tabs.map(t=> (
                    <TabBtn 
                        key={t.key} 
                        active={currentTab===t.key} 
                        label={t.label} 
                        count={filterRides(groups[t.key as keyof typeof groups]).length}
                        onClick={()=>switchTab(t.key as any)} 
                    />
                ))}
            </div>

            {/* Search & Date Filter */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search bookings..."
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select
                        className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    >
                        <option value="all">All Dates</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 w-10">
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredList.map((r:any)=> (
                 <tr key={r.id} className="hover:bg-gray-50/50 transition-colors group">
                   <td className="px-4 py-3">
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
                       className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                     />
                   </td>
                   <td className="px-4 py-3 font-medium text-gray-900">#{r.id}</td>
                   <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium">
                                {r.user?.firstName?.[0]}{r.user?.lastName?.[0]}
                            </div>
                            <div>
                                <div className="font-medium text-gray-900">{r.user?.firstName} {r.user?.lastName}</div>
                                <div className="text-xs text-gray-500">{r.user?.email}</div>
                            </div>
                        </div>
                   </td>
                   <td className="px-4 py-3 max-w-xs">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-1.5 text-xs">
                            <MapPin size={14} className="text-green-500 mt-0.5 shrink-0" />
                            <span className="text-gray-600 truncate" title={r.pickupAddress}>{r.pickupAddress}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-xs">
                            <MapPin size={14} className="text-red-500 mt-0.5 shrink-0" />
                            <span className="text-gray-600 truncate" title={r.dropoffAddress}>{r.dropoffAddress}</span>
                        </div>
                     </div>
                   </td>
                   <td className="px-4 py-3">
                     <div className="text-gray-900 font-medium">{new Date(r.pickupTime).toLocaleDateString()}</div>
                     <div className="text-xs text-gray-500">{new Date(r.pickupTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                   </td>
                   <td className="px-4 py-3 font-semibold text-gray-900">{r.price} DKK</td>
                   <td className="px-4 py-3">
                     <StatusBadge status={r.status} />
                   </td>
                   <td className="px-4 py-3">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            {r.paymentStatus === 'PAID' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                                    Paid
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                                    Unpaid
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 capitalize flex items-center gap-1">
                            <CreditCard size={12} />
                            {r.paymentMethod?.toLowerCase() || 'N/A'}
                        </div>
                     </div>
                   </td>
                   <td className="px-4 py-3 text-right">
                     <div className="relative inline-block text-left group-hover:opacity-100 opacity-100 sm:opacity-0 transition-opacity">
                       <select
                         className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                         onChange={async (e) => {
                           if (e.target.value) {
                             const action = e.target.value;
                             e.target.value = ''; // Reset select
                             if (confirm(`Are you sure you want to ${action.toLowerCase().replace('_', ' ')} this booking?`)) {
                               try {
                                 const response = await fetch('/api/admin/bookings/update', {
                                   method: 'POST',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ id: r.id, action: action })
                                 });
                                 if (response.ok) {
                                   if (typeof window !== 'undefined') {
                                     window.location.reload();
                                   }
                                 } else {
                                   const data = await response.json();
                                   alert(`Error: ${data.error || 'Unknown error'}`);
                                 }
                               } catch (error) {
                                 alert('Network error occurred');
                               }
                             }
                           }
                         }}
                         defaultValue=""
                       >
                         <option value="">Actions</option>
                         <option value="CONFIRM">✅ Confirm</option>
                         <option value="DISPATCH">🚗 Dispatch</option>
                         <option value="COMPLETE">📦 Complete</option>
                         <option value="CANCEL">❌ Cancel</option>
                         <option value="MARK_PAID">💳 Mark Paid</option>
                         <option value="REFUNDING">🔄 Refund in Progress</option>
                         <option value="REFUNDED">✅ Mark Refunded</option>
                       </select>
                     </div>
                   </td>
                 </tr>
               ))}
              {filteredList.length===0 && (
                <tr><td colSpan={9} className="p-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Search size={32} className="text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No bookings found</h3>
                    <p className="text-sm mt-1 max-w-xs mx-auto">We couldn't find any bookings matching your current filters. Try adjusting your search or date range.</p>
                    <button 
                        onClick={() => {setSearchTerm(''); setDateFilter('all');}}
                        className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                    >
                        <RefreshCw size={14} />
                        Clear Filters
                    </button>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
            </div>
        </div>
    )
}

function BulkActionButton({ onClick, label, icon, color }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${color}`}
        >
            {icon}
            {label}
        </button>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        COMPLETED: 'bg-green-100 text-green-700 border-green-200',
        DELIVERED: 'bg-green-100 text-green-700 border-green-200',
        PICKED_UP: 'bg-blue-100 text-blue-700 border-blue-200',
        CANCELED: 'bg-red-100 text-red-700 border-red-200',
        PROGRESSING: 'bg-blue-100 text-blue-700 border-blue-200',
        CONFIRMED: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        REFUNDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        REFUNDED: 'bg-purple-100 text-purple-700 border-purple-200',
        PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
        DISPATCHED: 'bg-indigo-100 text-indigo-700 border-indigo-200'
    };

    const style = styles[status as keyof typeof styles] || styles.PENDING;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
            {status.replace('_', ' ')}
        </span>
    );
}
