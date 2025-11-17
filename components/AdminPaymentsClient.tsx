"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminPath } from '@/lib/admin-route';

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
    <div className="grid gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-2">
            Manage payment methods and review all received payments.
          </p>
        </div>
        <Link
          href={getAdminPath()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('methods')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'methods'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Payment Methods
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'payments'
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Payments
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'methods' ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">Available Payment Methods</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentMethods.map((method: any) => (
                  <tr key={method.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{method.key}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{method.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {method.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          method.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <form
                        action={`/api/admin/payments/${method.id}/toggle`}
                        method="POST"
                        className="inline"
                      >
                        <button
                          type="submit"
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            method.isActive
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {method.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paymentMethods.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-500">No payment methods found.</div>
            </div>
          )}
          <div className="bg-blue-50 px-6 py-4 border-t border-blue-100">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Payment Method Management
            </h3>
            <p className="text-xs text-blue-800">
              • Active methods appear in the customer payment screen. • Invoice payment requires special
              user permissions.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Payment Method
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All</option>
                {uniqueMethods.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Invoice #
              </label>
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search by invoice number"
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
              />
            </div>
            <div className="text-xs text-gray-500 mt-5">
              Showing {filteredPayments.length} payments
            </div>
          </div>

          {/* Payments table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">All Payments</h3>
            </div>
            {loading ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-500">Loading payments...</div>
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-red-600 text-sm">
                {error}
              </div>
            ) : payments.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-gray-500">No payments found.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPayments.map((p, idx) => (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedPayment(p)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {p.invoiceId ? (
                            <Link
                              href={`/invoices/${p.invoiceId}`}
                              className="text-cyan-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {p.invoiceNumber || `INV-${p.invoiceId.toString().padStart(6, '0')}`}
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-xs">No invoice</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatMethodLabel(p.methodKey, p.type)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {p.amountDkk.toLocaleString('da-DK')} DKK
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {p.user ? (
                            <>
                              <div className="font-medium">
                                {p.user.firstName} {p.user.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{p.user.email}</div>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">Unknown</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <span
                            className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full ${
                              p.status.toUpperCase() === 'PAID' || p.status.toUpperCase() === 'CONFIRMED'
                                ? 'bg-green-100 text-green-800'
                                : p.status.toUpperCase().includes('PENDING')
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {formatStatus(p.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal for payment details */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-800">
                Payment Details
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Method</div>
                  <div className="font-medium">
                    {formatMethodLabel(selectedPayment.methodKey, selectedPayment.type)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Status</div>
                  <div className="font-medium">{formatStatus(selectedPayment.status)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Amount</div>
                  <div className="font-medium">
                    {selectedPayment.amountDkk.toLocaleString('da-DK')} DKK
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Date</div>
                  <div className="font-medium">
                    {formatDate(selectedPayment.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Source ID</div>
                  <div className="font-mono text-xs">{selectedPayment.sourceId}</div>
                </div>
                {selectedPayment.invoiceId && (
                  <div>
                    <div className="text-gray-500">Invoice</div>
                    <Link
                      href={`/invoices/${selectedPayment.invoiceId}`}
                      className="text-cyan-600 hover:underline text-sm"
                    >
                      {selectedPayment.invoiceNumber ||
                        `INV-${selectedPayment.invoiceId.toString().padStart(6, '0')}`}
                    </Link>
                  </div>
                )}
              </div>

              {selectedPayment.user && (
                <div className="border rounded-lg p-4 text-sm">
                  <div className="font-semibold mb-1">Customer</div>
                  <div>
                    {selectedPayment.user.firstName} {selectedPayment.user.lastName}
                  </div>
                  <div className="text-xs text-gray-500">{selectedPayment.user.email}</div>
                </div>
              )}

              {selectedPayment.extra && (
                <div className="border rounded-lg p-4 text-sm">
                  <div className="font-semibold mb-2">Extra Details</div>
                  <pre className="text-xs bg-gray-50 rounded-md p-3 overflow-x-auto">
                    {JSON.stringify(selectedPayment.extra, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}