"use client";
import { useState } from 'react';
import AdminComplaintModal from './AdminComplaintModal';
import {
  MessageSquare,
  User,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Search
} from 'lucide-react';

interface Complaint {
  id: number;
  complaint: string[] | string;
  status: string;
  adminDecision?: string;
  category?: string;
  priority?: string;
  slaDeadline?: string;
  escalated?: boolean;
  responseTemplate?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  ride: {
    id: number;
    pickupAddress: string;
    dropoffAddress: string;
    pickupTime: string;
  };
}

interface AdminComplaintsClientProps {
  initialComplaints: Complaint[];
}

export default function AdminComplaintsClient({ initialComplaints }: AdminComplaintsClientProps) {
  const [complaints, setComplaints] = useState(initialComplaints);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filtering state
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Bulk actions state
  const [selectedComplaints, setSelectedComplaints] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const handleViewComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setModalOpen(true);
  };

  const handleUpdateComplaint = async (complaintId: number, status: string, decision: string, category?: string, priority?: string, slaDeadline?: string, responseTemplate?: string) => {
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          adminDecision: decision,
          category,
          priority,
          slaDeadline,
          responseTemplate,
        }),
      });

      if (response.ok) {
        // Update local state
        setComplaints(complaints.map(c =>
          c.id === complaintId
            ? { ...c, status, adminDecision: decision }
            : c
        ));
        alert('Complaint updated successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update complaint');
      }
    } catch (error) {
      console.error('Failed to update complaint:', error);
      alert('Failed to update complaint. Please try again.');
      throw error;
    }
  };

  // Filter complaints based on current filters
  const filteredComplaints = complaints.filter(complaint => {
    const matchesStatus = statusFilter === 'all' || complaint.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || complaint.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || complaint.priority === priorityFilter;
    const matchesSearch = !searchTerm ||
      complaint.id.toString().includes(searchTerm) ||
      complaint.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Array.isArray(complaint.complaint)
        ? complaint.complaint.join(' ').toLowerCase().includes(searchTerm.toLowerCase())
        : complaint.complaint.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesCategory && matchesPriority && matchesSearch;
  });

  // Bulk actions handler
  const handleBulkAction = async (action: string) => {
    if (selectedComplaints.length === 0) return;

    if (!confirm(`Are you sure you want to ${action.toLowerCase().replace('_', ' ')} ${selectedComplaints.length} complaint(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const promises = selectedComplaints.map(async (complaintId) => {
        const response = await fetch(`/api/admin/complaints/${complaintId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: action === 'CLOSE' ? 'CLOSED' : action === 'ACCEPT' ? 'ACCEPTED' : 'OPEN',
            adminDecision: action === 'CLOSE' ? 'Bulk action: Closed' : action === 'ACCEPT' ? 'Bulk action: Accepted' : '',
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to update complaint ${complaintId}`);
        }
      });

      await Promise.all(promises);
      setSelectedComplaints([]);

      // Refresh the complaints list
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Some complaints could not be updated. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleReplyToComplaint = async (complaintId: number, reply: string) => {
    try {
      const response = await fetch(`/api/complaints/${complaintId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reply }),
      });

      if (response.ok) {
        // Fetch updated complaint data to refresh the conversation
        const updatedComplaintResponse = await fetch(`/api/complaints/${complaintId}`);
        if (updatedComplaintResponse.ok) {
          const updatedComplaintData = await updatedComplaintResponse.json();
          if (updatedComplaintData.ok) {
            // Update local state with the refreshed complaint data
            setComplaints(complaints.map(c =>
              c.id === complaintId
                ? { ...updatedComplaintData.complaint, updatedAt: new Date().toISOString() }
                : c
            ));
            // Also update the selected complaint if it's currently open
            if (selectedComplaint && selectedComplaint.id === complaintId) {
              setSelectedComplaint({ ...updatedComplaintData.complaint, updatedAt: new Date().toISOString() });
            }
          }
        }
        alert('Reply sent successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reply');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply. Please try again.');
      throw error;
    }
  };

  return (
    <>
      {/* Bulk Actions Bar */}
      {selectedComplaints.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-blue-800 font-medium">
            <CheckCircle size={18} />
            <span>{selectedComplaints.length} complaint(s) selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkAction('CLOSE')}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle size={14} />
              Close Selected
            </button>
            <button
              onClick={() => handleBulkAction('ACCEPT')}
              disabled={bulkActionLoading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={14} />
              Accept Selected
            </button>
            <button
              onClick={() => setSelectedComplaints([])}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-50/50">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search complaints..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ACCEPTED">Accepted</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="delay">Delay</option>
            <option value="driver">Driver Issue</option>
            <option value="pricing">Pricing</option>
            <option value="technical">Technical</option>
            <option value="other">Other</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedComplaints.length === filteredComplaints.length && filteredComplaints.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedComplaints(filteredComplaints.map(c => c.id));
                    } else {
                      setSelectedComplaints([]);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Booking</th>
              <th className="px-6 py-3">Complaint</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3">Priority</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredComplaints.map((complaint) => (
              <tr key={complaint.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedComplaints.includes(complaint.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedComplaints([...selectedComplaints, complaint.id]);
                      } else {
                        setSelectedComplaints(selectedComplaints.filter(id => id !== complaint.id));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium">
                        {complaint.user.firstName[0]}{complaint.user.lastName[0]}
                    </div>
                    <div>
                        <div className="font-medium text-gray-900">
                            {complaint.user.firstName} {complaint.user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{complaint.user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-gray-500">#{complaint.ride.id}</span>
                    <div className="flex items-center gap-1 text-xs text-gray-600 max-w-[200px] truncate" title={`${complaint.ride.pickupAddress} → ${complaint.ride.dropoffAddress}`}>
                        <MapPin size={12} className="shrink-0" />
                        {complaint.ride.pickupAddress} → {complaint.ride.dropoffAddress}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-gray-600 max-w-xs truncate block" title={Array.isArray(complaint.complaint) ? complaint.complaint.join(', ') : complaint.complaint}>
                        {Array.isArray(complaint.complaint) ? complaint.complaint[0] : complaint.complaint}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                    complaint.category === 'delay' ? 'bg-blue-100 text-blue-800' :
                    complaint.category === 'driver' ? 'bg-red-100 text-red-800' :
                    complaint.category === 'pricing' ? 'bg-green-100 text-green-800' :
                    complaint.category === 'technical' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {complaint.category || 'other'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                    complaint.priority === 'high' ? 'bg-red-100 text-red-800' :
                    complaint.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {complaint.priority || 'medium'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      complaint.status === 'OPEN'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                        : complaint.status === 'CLOSED'
                        ? 'bg-gray-50 text-gray-700 border-gray-100'
                        : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                      {complaint.status === 'OPEN' && <AlertCircle size={12} />}
                      {complaint.status === 'CLOSED' && <XCircle size={12} />}
                      {complaint.status === 'ACCEPTED' && <CheckCircle size={12} />}
                      {complaint.status}
                    </span>
                    {complaint.slaDeadline && complaint.status === 'OPEN' && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        new Date(complaint.slaDeadline) < new Date()
                          ? 'bg-red-100 text-red-700'
                          : new Date(complaint.slaDeadline).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        SLA: {new Date(complaint.slaDeadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {new Date(complaint.createdAt).toLocaleDateString()}
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleViewComplaint(complaint)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                  >
                    <Eye size={14} />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminComplaintModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        complaint={selectedComplaint}
        onUpdate={handleUpdateComplaint}
        onReply={handleReplyToComplaint}
      />
    </>
  );
}