"use client";
import { useState } from 'react';

interface Complaint {
  id: number;
  rideId: number;
  complaint: string;
  status: string;
  adminDecision: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ViewComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onCancel: () => Promise<void>;
}

export default function ViewComplaintModal({ isOpen, onClose, complaint, onCancel }: ViewComplaintModalProps) {
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this complaint?')) return;

    setCancelling(true);
    try {
      await onCancel();
      onClose();
    } catch (error) {
      console.error('Failed to cancel complaint:', error);
    } finally {
      setCancelling(false);
    }
  };

  if (!isOpen || !complaint) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-yellow-100 text-yellow-800';
      case 'CLOSED': return 'bg-green-100 text-green-800';
      case 'ACCEPTED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-800">Complaint Details</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Booking ID</label>
            <div className="p-3 bg-slate-50 rounded-md text-slate-800">#{complaint.rideId}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(complaint.status)}`}>
              {complaint.status}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Submitted Date</label>
            <div className="p-3 bg-slate-50 rounded-md text-slate-800">
              {new Date(complaint.createdAt).toLocaleString('en-US')}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Updated</label>
            <div className="p-3 bg-slate-50 rounded-md text-slate-800">
              {new Date(complaint.updatedAt).toLocaleString('en-US')}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Complaint</label>
            <div className="p-3 bg-slate-50 rounded-md text-slate-800 whitespace-pre-wrap">
              {complaint.complaint}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Decision</label>
            <div className="p-3 bg-slate-50 rounded-md text-slate-800 whitespace-pre-wrap">
              {complaint.adminDecision || 'No decision has been made yet'}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Close
          </button>
          {complaint.status === 'OPEN' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Complaint'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}