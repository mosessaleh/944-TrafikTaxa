"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminPath } from '@/lib/admin-route';
import { 
  CreditCard, 
  Wallet, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  MoreVertical,
  ArrowLeft,
  Eye,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

type AdminPaymentType = 'card' | 'crypto' | 'paypal' | 'revolut' | 'invoice';

interface AdminPaymentUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface AdminPaymentItem {
  id: string;
  sourceId: string;
  type: AdminPaymentType;
  methodKey: string;
  amountDkk: number;
  status: string;
  createdAt: string;
  user?: AdminPaymentUser | null;
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  extra?: Record<string, any>;
}

interface AdminPaymentsClientProps {
  paymentMethods: any[];
}

function formatMethodLabel(methodKey: string, type: AdminPaymentType): string {
  switch (methodKey) {
    case 'card':
      return 'Card';
    case 'crypto':
      return 'Crypto';
    case 'paypal':
      return 'PayPal';
    case 'revolut':
      return 'Revolut';
    case 'invoice':
      return type === 'invoice' ? 'Invoice' : 'Invoice / Manual';
    case 'admin_confirmed':
      return 'Admin Confirmed';
    default:
      return methodKey;
  }
}

function formatStatus(status: string): string {
  return status.toUpperCase();
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AdminPaymentsClient({ paymentMethods }: AdminPaymentsClientProps) {
  const [activeTab, setActiveTab] = useState<'methods' | 'payments'>('methods');
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentItem | null>(null);

  useEffect(() => {
    if (activeTab !== 'payments') return;

    const controller = new AbortController();
    const fetchPayments = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (methodFilter !== 'all') params.set('method', methodFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const query = params.toString();
        const res = await fetch(`/api/admin/payments${query ? `?${query}` : ''}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load payments');
        }

        const data = await res.json();
        setPayments(data.payments || []);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Failed to load admin payments', err);
        setError(err.message || 'Failed to load payments');
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    return () => {
      controller.abort();
    };
  }, [activeTab, methodFilter, statusFilter]);

  const uniqueMethods: { key: string; label: string }[] = [
    { key: 'card', label: 'Card' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'paypal', label: 'PayPal' },
    { key: 'revolut', label: 'Revolut' },
    { key: 'invoice', label: 'Invoice / Admin' },
  ];
 
  const filteredPayments = payments.filter((p) => {
    const term = invoiceSearch.trim().toLowerCase();
    if (!term) return true;
 
    const normalizedInvoice = (p.invoiceNumber
      ? p.invoiceNumber
      : p.invoiceId
      ? `INV-${p.invoiceId.toString().padStart(6, '0')}`
      : ''
    ).toLowerCase();
 
    return normalizedInvoice.includes(term);
  });
 
  const closeModal = () => setSelectedPayment(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage payment methods and review all received payments.
          </p>
        </div>
        <Link
          href={getAdminPath()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'methods'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <CreditCard size={16} />
            Payment Methods
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'payments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText size={16} />
            All Payments
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'methods' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Available Payment Methods</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Method</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentMethods.map((method: any) => (
                  <tr key={method.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 capitalize">
                      {method.key}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          method.isActive
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-gray-50 text-gray-600 border-gray-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${method.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form
                        action={`/api/admin/payments/${method.id}/toggle`}
                        method="POST"
                        className="inline-block"
                      >
                        <button
                          type="submit"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            method.isActive
                              ? 'text-red-700 bg-red-50 hover:bg-red-100 border border-red-100'
                              : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-100'
                          }`}
                        >
                          {method.isActive ? (
                            <>
                                <ToggleRight size={16} />
                                Deactivate
                            </>
                          ) : (
                            <>
                                <ToggleLeft size={16} />
                                Activate
                            </>
                          )}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paymentMethods.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No payment methods found.
            </div>
          )}
          <div className="bg-blue-50 px-6 py-4 border-t border-blue-100 flex gap-3">
            <div className="p-2 bg-blue-100 rounded-lg h-fit text-blue-600">
                <CreditCard size={20} />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Payment Method Management
                </h3>
                <p className="text-xs text-blue-700 leading-relaxed">
                Active methods appear in the customer payment screen. Invoice payment requires special user permissions.
                </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none min-w-[140px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                    >
                        <option value="all">All Methods</option>
                        {uniqueMethods.map((m) => (
                        <option key={m.key} value={m.key}>
                            {m.label}
                        </option>
                        ))}
                    </select>
                </div>
                <div className="relative flex-1 md:flex-none min-w-[140px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer"
                    >
                        <option value="all">All Statuses</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search invoice #..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
          </div>

          {/* Payments table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="px-6 py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                <div className="mt-2 text-gray-500 text-sm">Loading payments...</div>
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-red-600 text-sm bg-red-50">
                {error}
              </div>
            ) : payments.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No payments found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2 w-12">#</th>
                      <th className="px-4 py-2">Invoice</th>
                      <th className="px-4 py-2">Method</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayments.map((p, idx) => (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPayment(p)}
                      >
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2 font-medium">
                          {p.invoiceId ? (
                            <Link
                              href={`/invoices/${p.invoiceId}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText size={14} />
                              {p.invoiceNumber || `INV-${p.invoiceId.toString().padStart(6, '0')}`}
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No invoice</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700">
                            {p.methodKey === 'card' && <CreditCard size={12} />}
                            {p.methodKey === 'crypto' && <Wallet size={12} />}
                            {formatMethodLabel(p.methodKey, p.type)}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-semibold text-gray-900">
                          {p.amountDkk.toLocaleString('da-DK')} DKK
                        </td>
                        <td className="px-4 py-2">
                          {p.user ? (
                            <div>
                              <div className="font-medium text-gray-900">
                                {p.user.firstName} {p.user.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{p.user.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Unknown User</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              p.status.toUpperCase() === 'PAID' || p.status.toUpperCase() === 'CONFIRMED'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : p.status.toUpperCase().includes('PENDING')
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}
                          >
                            {p.status.toUpperCase() === 'PAID' && <CheckCircle size={12} />}
                            {p.status.toUpperCase().includes('PENDING') && <Clock size={12} />}
                            {formatStatus(p.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                            <button className="text-gray-400 hover:text-blue-600 transition-colors">
                                <Eye size={18} />
                            </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 text-center">
            Showing {filteredPayments.length} payments
          </div>
        </div>
      )}

      {/* Modal for payment details */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-gray-500" />
                Payment Details
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Amount</label>
                        <div className="text-2xl font-bold text-gray-900">{selectedPayment.amountDkk.toLocaleString('da-DK')} DKK</div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Status</label>
                        <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                            selectedPayment.status.toUpperCase() === 'PAID' || selectedPayment.status.toUpperCase() === 'CONFIRMED'
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : selectedPayment.status.toUpperCase().includes('PENDING')
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                : 'bg-red-50 text-red-700 border-red-100'
                            }`}
                        >
                            {formatStatus(selectedPayment.status)}
                        </span>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Date</label>
                        <div className="text-sm text-gray-700">{formatDate(selectedPayment.createdAt)}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Payment Method</label>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <CreditCard size={16} className="text-gray-400" />
                            {formatMethodLabel(selectedPayment.methodKey, selectedPayment.type)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source ID</label>
                        <div className="text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 break-all">
                            {selectedPayment.sourceId}
                        </div>
                    </div>
                    {selectedPayment.invoiceId && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Invoice</label>
                            <Link
                            href={`/invoices/${selectedPayment.invoiceId}`}
                            className="text-blue-600 hover:underline text-sm font-medium flex items-center gap-1"
                            >
                            <FileText size={14} />
                            {selectedPayment.invoiceNumber ||
                                `INV-${selectedPayment.invoiceId.toString().padStart(6, '0')}`}
                            </Link>
                        </div>
                    )}
                </div>
              </div>

              {selectedPayment.user && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                        {selectedPayment.user.firstName[0]}{selectedPayment.user.lastName[0]}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900">
                            {selectedPayment.user.firstName} {selectedPayment.user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{selectedPayment.user.email}</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedPayment.extra && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Technical Details
                  </label>
                  <pre className="text-xs bg-slate-900 text-slate-300 rounded-xl p-4 overflow-x-auto font-mono">
                    {JSON.stringify(selectedPayment.extra, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-all shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}