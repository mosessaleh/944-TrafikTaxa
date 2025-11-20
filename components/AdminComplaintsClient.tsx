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
  Eye
} from 'lucide-react';

interface Complaint {
  id: number;
  complaint: string[] | string;
  status: string;
  adminDecision?: string;
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

  const handleViewComplaint = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setModalOpen(true);
  };

  const handleUpdateComplaint = async (complaintId: number, status: string, decision: string) => {
    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          adminDecision: decision,
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
            <tr>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Booking</th>
              <th className="px-6 py-3">Complaint</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {complaints.map((complaint) => (
              <tr key={complaint.id} className="hover:bg-gray-50/50 transition-colors group">
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