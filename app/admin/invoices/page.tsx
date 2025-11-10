"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Invoice {
  id: number;
  invoiceNumber: string;
  userId: number;
  rideId: number;
  createdAt: string;
  dueDate: string;
  status: number;
  paymentStatus: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  ride: {
    id: number;
    price: number;
    vehicleType: {
      title: string;
    };
  };
}

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      } else if (response.status === 401) {
        router.push('/login');
        return;
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setError('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to confirm payment for this invoice? This will mark the invoice as paid and update the booking status.')) {
      return;
    }

    setActionLoading(invoiceId);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/confirm-payment`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Payment confirmed successfully!');
        fetchInvoices(); // Refresh the list
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to confirm payment: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to confirm payment:', error);
      alert('Failed to confirm payment. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReminder = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to send a payment reminder to this customer?')) {
      return;
    }

    setActionLoading(invoiceId);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/send-reminder`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Reminder sent successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to send reminder: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send reminder:', error);
      alert('Failed to send reminder. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendAlert = async (invoiceId: number) => {
    // For now, just show a placeholder message
    alert('Send Alert functionality is not yet implemented.');
  };

  const handleCancelInvoice = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) {
      return;
    }

    setActionLoading(invoiceId);
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        alert('Invoice cancelled successfully!');
        fetchInvoices(); // Refresh the list
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to cancel invoice: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to cancel invoice:', error);
      alert('Failed to cancel invoice. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading invoices...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 pb-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/admin')}
              className="btn-primary"
            >
              Back to Admin Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Invoice Management</h1>
          <p className="text-slate-600">Manage unpaid invoices and send reminders</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-4">📄</div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total Unpaid Invoices</p>
                <p className="text-2xl font-bold text-slate-900">{invoices.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-4 text-red-500">⏰</div>
              <div>
                <p className="text-sm font-medium text-slate-600">Overdue</p>
                <p className="text-2xl font-bold text-slate-900">
                  {invoices.filter(invoice => new Date(invoice.dueDate) < new Date()).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-4 text-green-500">💰</div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  {invoices.reduce((sum, invoice) => sum + invoice.ride.price, 0)} DKK
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">Unpaid Invoices</h2>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">No unpaid invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {invoices.map((invoice) => {
                    const isOverdue = new Date(invoice.dueDate) < new Date();
                    const isLoading = actionLoading === invoice.id;

                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {invoice.invoiceNumber}
                            </div>
                            <div className="text-sm text-slate-500">
                              Booking #{invoice.rideId}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {invoice.user.firstName} {invoice.user.lastName}
                            </div>
                            <div className="text-sm text-slate-500">
                              {invoice.user.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {invoice.ride.price} DKK
                          </div>
                          <div className="text-sm text-slate-500">
                            {invoice.ride.vehicleType.title}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                            {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          {isOverdue && (
                            <div className="text-xs text-red-500 font-medium">
                              OVERDUE
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.paymentStatus === 'PAID'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {invoice.paymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="relative">
                            <select
                              onChange={(e) => {
                                const action = e.target.value;
                                e.target.value = ''; // Reset select

                                if (action === 'confirm') handleConfirmPayment(invoice.id);
                                else if (action === 'reminder') handleSendReminder(invoice.id);
                                else if (action === 'alert') handleSendAlert(invoice.id);
                                else if (action === 'cancel') handleCancelInvoice(invoice.id);
                              }}
                              disabled={isLoading}
                              className="text-sm border border-slate-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <option value="">Actions</option>
                              <option value="confirm">✅ Confirm Payment</option>
                              <option value="reminder">📧 Send Reminder</option>
                              <option value="alert">🚨 Send Alert</option>
                              <option value="cancel">❌ Cancel Invoice</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/admin')}
            className="btn-ghost"
          >
            ← Back to Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}