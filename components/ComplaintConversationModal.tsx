"use client";
import { useState } from 'react';

// Import translation files
import dkMessages from '../messages/dk.json';
import enMessages from '../messages/en.json';

// Translation function
function useTranslations() {
  const language = typeof window !== 'undefined' ? (localStorage.getItem('language') || 'dk') : 'dk';

  const t = (key: string) => {
    const keys = key.split('.');
    const messages = language === 'dk' ? dkMessages : enMessages;
    let value: any = messages;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return t;
}

interface Complaint {
  id: number;
  rideId: number;
  complaint: string[] | string;
  status: string;
  adminDecision: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplaintConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onReply: (reply: string) => Promise<void>;
}

export default function ComplaintConversationModal({
  isOpen,
  onClose,
  complaint,
  onReply
}: ComplaintConversationModalProps) {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations();

  if (!isOpen || !complaint) return null;

  // Ensure complaint is an array
  const conversation = Array.isArray(complaint.complaint) ? complaint.complaint : [complaint.complaint];

  // Check if user can reply (textbox should be disabled if user was the last to reply)
  const lastMessage = conversation[conversation.length - 1];
  const canReply = lastMessage?.startsWith('Admin:') || conversation.length === 1;

  const handleReply = async () => {
    if (!replyText.trim()) {
      alert(t('account.complaints.enterReplyMessage'));
      return;
    }

    setIsSubmitting(true);
    try {
      await onReply(replyText.trim());
      setReplyText('');
      // Modal will be closed by parent component after successful reply
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert(t('account.complaints.failedToSendReply'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseComplaint = async () => {
    // This would need to be implemented in the API
    alert(t('account.history.closeComplaintNotImplemented'));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">{t('account.complaints.conversation')}</h2>
          <p className="text-blue-100">{t('account.complaints.bookingIdShort').replace('{id}', complaint.rideId.toString())}</p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Complaint Info */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('account.complaints.bookingID')}</label>
                <p className="text-gray-900 font-medium">{complaint.rideId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('account.complaints.status')}</label>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  complaint.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' :
                  complaint.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {complaint.status}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('account.complaints.created')}</label>
              <p className="text-gray-900">{new Date(complaint.createdAt).toLocaleString()}</p>
            </div>

            {complaint.adminDecision && (
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('account.complaints.adminDecision')}</label>
                <p className="text-gray-900">{complaint.adminDecision}</p>
              </div>
            )}
          </div>

          {/* Conversation */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('account.complaints.conversationTitle')}</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {conversation.map((message, index) => {
                // Parse the message format "Sender: message content"
                const colonIndex = message.indexOf(':');
                const sender = message.substring(0, colonIndex).trim();
                const content = message.substring(colonIndex + 1).trim();

                return (
                  <div key={index} className={`p-3 rounded-lg ${
                    sender === 'Me'
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : 'bg-gray-50 border-l-4 border-gray-500'
                  }`}>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-sm text-gray-700 min-w-0 flex-shrink-0">
                        {sender === 'Me' ? t('account.complaints.you') : sender === 'Admin' ? t('account.complaints.admin') : sender + ':'}
                      </span>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reply Section */}
          {complaint.status === 'OPEN' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">{t('account.complaints.yourReply')}</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={!canReply}
                placeholder={canReply ? t('account.complaints.typeReply') : t('account.complaints.waitingForAdmin')}
                className={`w-full p-3 border rounded-lg resize-none ${
                  canReply
                    ? 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed'
                }`}
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t('account.complaints.back')}
          </button>

          <div className="flex gap-3">
            {complaint.status === 'OPEN' && (
              <>
                <button
                  onClick={handleReply}
                  disabled={!canReply || !replyText.trim() || isSubmitting}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    canReply && replyText.trim() && !isSubmitting
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? t('account.complaints.sending') : t('account.complaints.sendReply')}
                </button>

                <button
                  onClick={handleCloseComplaint}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  {t('account.complaints.closeIssue')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}