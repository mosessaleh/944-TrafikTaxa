'use client';

import { useState, useRef, useEffect } from 'react';
import { useRealtime } from './RealtimeProvider';
import { ChatMessagePayload } from '@/lib/realtime';

interface ChatWidgetProps {
  bookingId: number;
  driverName?: string;
  className?: string;
}

export default function ChatWidget({ bookingId, driverName = 'السائق', className = '' }: ChatWidgetProps) {
  const { sendChatMessage, chatMessages, isConnected } = useRealtime();
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter messages for this booking
  const bookingMessages = chatMessages.filter(msg => msg.bookingId === bookingId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [bookingMessages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isConnected) return;

    // In a real app, you'd get the recipient user ID from props or context
    const recipientId = 'driver_' + bookingId; // Placeholder

    sendChatMessage(bookingId, message.trim(), recipientId);
    setMessage('');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-colors duration-200"
          aria-label="فتح الدردشة"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {bookingMessages.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {bookingMessages.length}
            </span>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl w-80 h-96 flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div>
              <h3 className="font-medium">دردشة مع {driverName}</h3>
              <p className="text-sm opacity-90">
                {isConnected ? 'متصل' : 'غير متصل'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-700 rounded-full p-1"
              aria-label="إغلاق الدردشة"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {bookingMessages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm">
                <p>ابدأ المحادثة مع السائق</p>
              </div>
            ) : (
              bookingMessages.map((msg) => (
                <div
                  key={msg.messageId}
                  className={`flex ${msg.fromUserId === 'current_user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      msg.fromUserId === 'current_user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.fromUserId === 'current_user' ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      {formatTime(msg.timestamp || Date.now())}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={isConnected ? "اكتب رسالتك..." : "غير متصل..."}
                disabled={!isConnected}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!message.trim() || !isConnected}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                aria-label="إرسال الرسالة"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            {!isConnected && (
              <p className="text-xs text-red-600 mt-2">
                يجب أن تكون متصلاً لإرسال الرسائل
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}