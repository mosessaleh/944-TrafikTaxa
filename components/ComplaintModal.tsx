"use client";
import { useState } from 'react';

interface ComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  onSubmit: (complaint: string) => Promise<void>;
}

export default function ComplaintModal({ isOpen, onClose, bookingId, onSubmit }: ComplaintModalProps) {
  const [complaint, setComplaint] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint.trim()) return;

    setLoading(true);
    try {
      await onSubmit(complaint.trim());
      setComplaint('');
      onClose();
    } catch (error) {
      console.error('Failed to submit complaint:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Submit Complaint</h2>
        <p className="text-sm text-slate-600 mb-4">
          Booking #{bookingId}
        </p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Please describe your complaint..."
            className="w-full p-3 border border-slate-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            rows={4}
            required
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !complaint.trim()}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}