"use client";
import { useState } from 'react';
import AdminComplaintModal from './AdminComplaintModal';

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
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Complaint
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <tr key={complaint.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {complaint.user.firstName} {complaint.user.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{complaint.user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">#{complaint.ride.id}</div>
                  <div className="text-sm text-gray-500 max-w-xs truncate">
                    {complaint.ride.pickupAddress} → {complaint.ride.dropoffAddress}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600 max-w-xs truncate">
                    {complaint.complaint}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    complaint.status === 'OPEN'
                      ? 'bg-yellow-100 text-yellow-800'
                      : complaint.status === 'CLOSED'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {complaint.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleViewComplaint(complaint)}
                    className="text-cyan-600 hover:text-cyan-900 px-3 py-1 rounded-md hover:bg-cyan-50"
                  >
                    View Details
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