"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit, CheckCircle, Mail, AlertTriangle, X, Search, FileText } from 'lucide-react';

interface InvoiceWithPriority {
  id: number;
  invoiceNumber: string;
  userId: number;
  rideId: number;
  createdAt: string;
  dueDate: string;
  dueDateFormatted: string;
  status: number;
  paymentStatus: string;
  paymentMethod?: string;
  paymentRef?: string;
  paymentDate?: string;
  paymentAmount?: number;
  paymentNotes?: string;
  confirmedBy?: number;
  confirmedAt?: string;
  receiptNumber?: string;
  lateFee1?: number;
  lateFee2?: number;
  lateFee1Date?: string;
  lateFee2Date?: string;
  extendedDueDate?: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  ride: {
    id: number;
    price: number;
  };
  priority: 'high' | 'medium' | 'low';
  isOverdue: boolean;
  daysUntilDue: number;
  totalAmount: number;
}

interface AdminInvoicesClientProps {
  initialInvoices: InvoiceWithPriority[];
}

export default function AdminInvoicesClient({ initialInvoices }: AdminInvoicesClientProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithPriority[]>(initialInvoices);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithPriority | null>(null);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return invoices;

    return invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.user.firstName.toLowerCase().includes(term) ||
      inv.user.lastName.toLowerCase().includes(term) ||
      inv.user.email.toLowerCase().includes(term) ||
      String(inv.id).includes(term)
    );
  }, [invoices, searchTerm]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/invoices', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (invoiceId: number, action: string) => {
    setActionLoading(invoiceId);
    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, action }),
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || `Failed to ${action.replace('_', ' ')}`);
        return;
      }

      alert(data.message || 'Action completed successfully');
      await fetchInvoices(); // Refresh the list
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Failed to ${action.replace('_', ' ')}. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const stats = {
    total: filteredInvoices.length,
    overdue: filteredInvoices.filter(inv => inv.isOverdue).length,
    dueSoon: filteredInvoices.filter(inv => !inv.isOverdue && inv.daysUntilDue <= 3).length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage unpaid invoices and send reminders.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Unpaid</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-red-600">Overdue</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm">
          <div className="text-2xl font-bold text-yellow-600">{stats.dueSoon}</div>
          <div className="text-sm text-yellow-600">Due Soon</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{stats.totalAmount.toFixed(2)}</div>
          <div className="text-sm text-blue-600">Total Amount (DKK)</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by invoice, customer, or ID..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <div className="mt-2 text-gray-500 text-sm">Loading invoices...</div>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-red-600 text-sm bg-red-50">
            {error}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Search size={24} className="text-gray-400" />
              </div>
              <p>No invoices found matching your search.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-16">ID</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-4 py-3 text-gray-500">#{invoice.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                          <FileText size={16} />
                        </div>
                        <div>
                          <a
                            href={`/invoices/${invoice.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          >
                            {invoice.invoiceNumber}
                          </a>
                          <div className="flex items-center gap-1 mt-1">
                            {invoice.isOverdue && (
                              <AlertTriangle size={14} className="text-red-500" />
                            )}
                            {invoice.paymentStatus === 'PAID' && (
                              <CheckCircle size={14} className="text-green-500" />
                            )}
                            {/* Late fee indicators */}
                            {invoice.lateFee1 && (
                              <span className="text-red-500 text-xs font-bold">▲</span>
                            )}
                            {invoice.lateFee2 && (
                              <span className="text-red-500 text-xs font-bold">▲</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {invoice.user.firstName} {invoice.user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{invoice.user.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {invoice.dueDateFormatted}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {invoice.totalAmount.toFixed(2)} DKK
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          invoice.priority === 'high'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : invoice.priority === 'medium'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                            : 'bg-gray-50 text-gray-600 border-gray-100'
                        }`}
                      >
                        {invoice.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Invoice"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(invoice.id, 'confirm_payment')}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                          title="Confirm Payment"
                          disabled={actionLoading === invoice.id}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => handleAction(invoice.id, 'send_reminder')}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Reminder"
                          disabled={actionLoading === invoice.id}
                        >
                          <Mail size={16} />
                        </button>
                        {(!invoice.lateFee1 || !invoice.lateFee2) && (
                          <button
                            onClick={() => handleAction(invoice.id, 'send_late_fee')}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Send Late Fee"
                            disabled={actionLoading === invoice.id}
                          >
                            <AlertTriangle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Invoice Modal */}
      {selectedInvoice && (
        <EditInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSave={() => {
            setSelectedInvoice(null);
            fetchInvoices(); // Refresh the list
          }}
        />
      )}
    </div>
  );
}

// Edit Invoice Modal Component
function EditInvoiceModal({
  invoice,
  onClose,
  onSave
}: {
  invoice: InvoiceWithPriority;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    dueDate: new Date(invoice.dueDate).toISOString().split('T')[0],
    paymentAmount: invoice.paymentAmount || invoice.ride?.price || 0,
    paymentNotes: invoice.paymentNotes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          dueDate: formData.dueDate,
          paymentAmount: formData.paymentAmount,
          paymentNotes: formData.paymentNotes,
        }),
      });

      if (response.ok) {
        onSave();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to update invoice: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update invoice:', error);
      alert('Failed to update invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Edit size={18} className="text-gray-500" />
            Edit Invoice
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Number
            </label>
            <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border">
              {invoice.invoiceNumber}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount (DKK)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.paymentAmount}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentAmount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Notes
            </label>
            <textarea
              value={formData.paymentNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentNotes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes about the payment..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}