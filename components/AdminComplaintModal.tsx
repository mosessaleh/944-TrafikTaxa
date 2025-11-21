"use client";
import { useState, useEffect } from 'react';

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

interface AdminComplaintModalProps {
   isOpen: boolean;
   onClose: () => void;
   complaint: Complaint | null;
   onUpdate: (complaintId: number, status: string, decision: string, category?: string, priority?: string, slaDeadline?: string, responseTemplate?: string) => Promise<void>;
   onReply: (complaintId: number, reply: string) => Promise<void>;
 }

export default function AdminComplaintModal({ isOpen, onClose, complaint, onUpdate, onReply }: AdminComplaintModalProps) {
   const [status, setStatus] = useState('');
   const [decision, setDecision] = useState('');
   const [reply, setReply] = useState('');
   const [loading, setLoading] = useState(false);
   const [replyLoading, setReplyLoading] = useState(false);

   // New fields
   const [category, setCategory] = useState('');
   const [priority, setPriority] = useState('medium');
   const [slaDeadline, setSlaDeadline] = useState('');
   const [responseTemplate, setResponseTemplate] = useState('');

   // Response templates
   const responseTemplates = {
     delay: [
       { id: 'delay_apology', title: 'Delay Apology', content: 'We sincerely apologize for the delay in your ride. We are working to resolve this issue and ensure better service in the future.' },
       { id: 'delay_compensation', title: 'Delay with Compensation', content: 'We apologize for the inconvenience caused by the delay. As compensation, we will provide you with a 20% discount on your next ride.' }
     ],
     driver: [
       { id: 'driver_behavior', title: 'Driver Behavior Issue', content: 'Thank you for bringing this to our attention. We take driver conduct very seriously and will investigate this matter immediately.' },
       { id: 'driver_rating', title: 'Driver Rating Review', content: 'We have noted your feedback about the driver. All drivers are regularly reviewed based on customer feedback to maintain service quality.' }
     ],
     pricing: [
       { id: 'pricing_explanation', title: 'Pricing Explanation', content: 'The fare calculation includes base fare, distance, time, and any applicable surcharges. We can review your specific ride details if needed.' },
       { id: 'pricing_refund', title: 'Pricing Dispute Resolution', content: 'We understand your concern about the pricing. Our team will review the fare calculation and contact you within 24 hours with a resolution.' }
     ],
     technical: [
       { id: 'technical_issue', title: 'Technical Issue Acknowledgment', content: 'We apologize for the technical difficulties you experienced. Our technical team is aware of this issue and working on a fix.' },
       { id: 'app_problem', title: 'App/Website Issue', content: 'Thank you for reporting this technical issue. We regularly update our systems to improve performance and user experience.' }
     ],
     other: [
       { id: 'general_apology', title: 'General Apology', content: 'We apologize for any inconvenience caused. Your feedback helps us improve our service. We will address this matter promptly.' }
     ]
   };

  useEffect(() => {
    if (complaint) {
      setStatus(complaint.status);
      setDecision(complaint.adminDecision || '');
      setReply('');
      setCategory(complaint.category || 'other');
      setPriority(complaint.priority || 'medium');
      setSlaDeadline(complaint.slaDeadline ? new Date(complaint.slaDeadline).toISOString().slice(0, 16) : '');
      setResponseTemplate(complaint.responseTemplate || '');
    }
  }, [complaint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setLoading(true);
    try {
      await onUpdate(complaint.id, status, decision, category, priority, slaDeadline, responseTemplate);
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
           {/* Category and Priority */}
           <div className="grid grid-cols-2 gap-4 mb-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Category
               </label>
               <select
                 value={category}
                 onChange={(e) => setCategory(e.target.value)}
                 className="w-full p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
               >
                 <option value="delay">Delay</option>
                 <option value="driver">Driver Issue</option>
                 <option value="pricing">Pricing</option>
                 <option value="technical">Technical</option>
                 <option value="other">Other</option>
               </select>
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Priority
               </label>
               <select
                 value={priority}
                 onChange={(e) => setPriority(e.target.value)}
                 className="w-full p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
               >
                 <option value="low">Low</option>
                 <option value="medium">Medium</option>
                 <option value="high">High</option>
               </select>
             </div>
           </div>

           {/* SLA Deadline */}
           <div className="mb-4">
             <label className="block text-sm font-medium text-gray-700 mb-2">
               SLA Deadline
             </label>
             <input
               type="datetime-local"
               value={slaDeadline}
               onChange={(e) => setSlaDeadline(e.target.value)}
               className="w-full p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
             />
           </div>

           {/* Response Templates */}
           {responseTemplates[category as keyof typeof responseTemplates] && (
             <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Quick Response Templates
               </label>
               <select
                 value={responseTemplate}
                 onChange={(e) => {
                   const selectedTemplate = e.target.value;
                   setResponseTemplate(selectedTemplate);
                   if (selectedTemplate) {
                     const templates = responseTemplates[category as keyof typeof responseTemplates];
                     const template = templates.find(t => t.id === selectedTemplate);
                     if (template) {
                       setReply(template.content);
                     }
                   }
                 }}
                 className="w-full p-3 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-2"
               >
                 <option value="">Select a template...</option>
                 {responseTemplates[category as keyof typeof responseTemplates].map(template => (
                   <option key={template.id} value={template.id}>
                     {template.title}
                   </option>
                 ))}
               </select>
             </div>
           )}

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