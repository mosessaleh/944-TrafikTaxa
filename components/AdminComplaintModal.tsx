"use client";
import { useState, useEffect } from 'react';

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

interface AdminComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onUpdate: (complaintId: number, status: string, decision: string) => Promise<void>;
  onReply: (complaintId: number, reply: string) => Promise<void>;
}

export default function AdminComplaintModal({ isOpen, onClose, complaint, onUpdate, onReply }: AdminComplaintModalProps) {
  const [status, setStatus] = useState('');
  const [decision, setDecision] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);

  useEffect(() => {
    if (complaint) {
      setStatus(complaint.status);
      setDecision(complaint.adminDecision || '');
      setReply('');
    }
  }, [complaint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setLoading(true);
    try {
      await onUpdate(complaint.id, status, decision);
      onClose();
    } catch (error) {
      console.error('Failed to update complaint:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !complaint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Complaint Details</h2>

        {/* Customer Info */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Customer Information</h3>
          <p className="text-sm text-gray-600">
            <strong>Name:</strong> {complaint.user.firstName} {complaint.user.lastName}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> {complaint.user.email}
          </p>
        </div>

        {/* Booking Info */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Booking Information</h3>
          <p className="text-sm text-gray-600">
            <strong>Booking ID:</strong> #{complaint.ride.id}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Route:</strong> {complaint.ride.pickupAddress} → {complaint.ride.dropoffAddress}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Pickup Time:</strong> {new Date(complaint.ride.pickupTime).toLocaleString()}
          </p>
        </div>

        {/* Conversation */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">Conversation</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {Array.isArray(complaint.complaint) ? (
              complaint.complaint.map((message: string, index: number) => {
                // Parse the message format "Sender: message content"
                const colonIndex = message.indexOf(':');
                const sender = message.substring(0, colonIndex).trim();
                const content = message.substring(colonIndex + 1).trim();

                const isAdmin = sender === 'Admin';
                const isUser = sender === 'Me';

                return (
                  <div key={index} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isAdmin
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-green-100 text-green-900'
                    }`}>
                      <p className="text-sm font-medium mb-1">
                        {isAdmin ? 'Admin' : 'Customer'}
                      </p>
                      <p className="text-sm">{content}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex justify-end">
                <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-green-100 text-green-900">
                  <p className="text-sm font-medium mb-1">Customer</p>
                  <p className="text-sm">{complaint.complaint}</p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(complaint.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* Reply Section */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-3">Send Reply</h3>
          <div className="space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply to the customer..."
              className="w-full p-3 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              rows={3}
              disabled={replyLoading}
            />
            <button
              type="button"
              onClick={async () => {
                if (!reply.trim()) return;

                setReplyLoading(true);
                try {
                  await onReply(complaint.id, reply.trim());
                  setReply('');
                } catch (error) {
                  console.error('Failed to send reply:', error);
                } finally {
                  setReplyLoading(false);
                }
              }}
              disabled={replyLoading || !reply.trim()}
              className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {replyLoading ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Status */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="ACCEPTED">Accepted</option>
            </select>
          </div>

          {/* Admin Decision */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Decision {(status === 'CLOSED' || status === 'ACCEPTED') && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="Enter your decision or resolution..."
              className="w-full p-3 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              rows={4}
              required={status === 'CLOSED' || status === 'ACCEPTED'}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || ((status === 'CLOSED' || status === 'ACCEPTED') && !decision.trim())}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}