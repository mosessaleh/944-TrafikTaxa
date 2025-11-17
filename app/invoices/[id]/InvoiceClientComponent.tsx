'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

function InvoiceClientComponent({ invoiceId }: { invoiceId: string }) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoiceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const fetchInvoiceData = async () => {
    try {
      console.log('Client: Starting to fetch invoice data for ID:', invoiceId);
      
      const response = await fetch(`/api/invoices/${invoiceId}/data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'same-origin',
      });
      
      console.log('Client: API Response status:', response.status);
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.warn('Could not parse error response as JSON');
        }
        
        console.error('Client: API Error:', response.status, errorData);
        const errorText = (errorData as any)?.error || response.statusText;
        throw new Error(`Failed to load invoice: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Client: Successfully fetched invoice data:', data);
      
      if (data.success && data.invoice) {
        setInvoice(data.invoice);
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (err) {
      let errorMessage = 'Unable to load invoice. Please try again.';
      
      if (err instanceof Error) {
        console.error('Client: Invoice loading error:', err.message);
        
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Please log in to view this invoice.';
        } else if (err.message.includes('404') || err.message.includes('not found')) {
          errorMessage = 'Invoice not found. It may have been deleted.';
        } else if (err.message.includes('403') || err.message.includes('Access denied')) {
          errorMessage = 'You do not have permission to view this invoice.';
        } else if (err.message.includes('500') || err.message.includes('Internal server error')) {
          errorMessage = 'Server error. Please try again later.';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      } else {
        console.error('Client: Unknown error type:', err);
      }
      
      console.error('Client: Final error setting:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('print').matches) return;

    const hiddenElements = document.querySelectorAll('.hide-for-print');
    const hiddenStyles: Array<{ element: Element; originalVisibility: string; originalPosition: string }> = [];

    hiddenElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const originalVisibility = htmlEl.style.visibility || '';
      const originalPosition = htmlEl.style.position || '';
      hiddenStyles.push({ element: el, originalVisibility, originalPosition });
      htmlEl.style.visibility = 'hidden';
      htmlEl.style.position = 'absolute';
    });

    window.print();

    setTimeout(() => {
      hiddenStyles.forEach(({ element, originalVisibility, originalPosition }) => {
        const htmlEl = element as HTMLElement;
        htmlEl.style.visibility = originalVisibility;
        htmlEl.style.position = originalPosition;
      });
    }, 400);
  };

  const handlePayNow = () => {
    if (!invoice) return;
    window.open(`/pay?invoice=${invoice.id}&booking=${invoice.ride.id}&amount_dkk=${invoice.ride.price}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Invoice</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/account?tab=invoices" className="text-blue-600 hover:text-blue-800">
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Invoice Not Found</h2>
          <Link href="/account?tab=invoices" className="text-blue-600 hover:text-blue-800">
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const isPaid = invoice.paymentStatus === 'PAID';
  const isUnpaid = invoice.paymentStatus === 'UNPAID';
  const isOverdue = invoice.paymentStatus === 'OVERDUE';

  return (
    <>
      {/* Print/screen styles (avoid creating a second page) */}
      <style jsx global>{`
        .num { font-variant-numeric: tabular-nums; }

        @media print {
          @page { margin: 6mm !important; size: A4; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            zoom: 0.95 !important;
          }
          @supports not (zoom: 1) {
            .invoice-root {
              transform: scale(0.95);
              transform-origin: top left;
              width: calc(100% / 0.95);
            }
          }
          .overflow-hidden { overflow: visible !important; }
          .invoice-container, .invoice-page, .invoice-content {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .invoice-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .invoice-content { padding: 0 !important; }
          .p-6 { padding: 1rem !important; }
          .p-4 { padding: 0.75rem !important; }
          .px-4 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
          .mb-6 { margin-bottom: 0.75rem !important; }
          .border-t { border-top-width: 0 !important; }
          .hide-for-print { display: none !important; }
        }
      `}</style>

      {/* UI buttons (outside the invoice sheet) */}
      <div className="hide-for-print mb-6 flex justify-start gap-3">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-gray-900 text-white text-xs rounded-xl hover:bg-black transition-colors"
          type="button"
        >
          🖨️ Print
        </button>
        {isUnpaid && (
          <button
            onClick={handlePayNow}
            className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-xl hover:bg-emerald-700 transition-colors"
            type="button"
          >
            💳 Pay
          </button>
        )}
      </div>

      {/* Invoice sheet */}
      <div className="invoice-root max-w-4xl mx-auto">
        <div className="invoice-page bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden">

          {/* Header: logo on the right, invoice number below */}
          <div className="bg-white border-b border-gray-200 px-6 sm:px-8 py-6">
            <div className="flex items-start justify-between gap-6">
              {/* Company information on the left */}
              <div className="text-[13px] text-gray-600 leading-5">
                <p className="font-semibold text-gray-800">944 Trafik</p>
                <p>Frederikssund, Denmark</p>
                <p>Phone: 26444944</p>
                <p>Email: trafik@944.dk</p>
              </div>

              {/* Right: logo and invoice number below it */}
              <div className="text-right flex flex-col items-end">
                {/* Use a plain <img> to avoid next/image issues with SVG (400: The requested resource isn't a valid image) */}
                <img
                  src="/logo.svg"
                  alt="944 Trafik - Professional Taxi Service in Denmark"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Two-column box: left (invoice number + status) — right (date + due date) */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 sm:px-8 py-3">
            <div className="grid grid-cols-2 items-start gap-4 text-xs text-gray-700">
              {/* Left: invoice number + status */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-gray-500">Invoice No.</span>
                  <span className="num font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="uppercase tracking-wide text-[10px] text-gray-500">Status</span>
                  <span
                    className={[
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
                      isPaid && 'bg-green-100 text-green-800 border border-green-200',
                      isUnpaid && 'bg-red-100 text-red-800 border border-red-200',
                      isOverdue && 'bg-orange-100 text-orange-800 border border-orange-200',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {invoice.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Right: date + due date aligned to the right */}
              <div className="flex flex-col gap-1 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className="uppercase tracking-wide text-[10px] text-gray-500">Date</span>
                  <span className="num font-medium">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="uppercase tracking-wide text-[10px] text-gray-500">Due</span>
                  <span className="num font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="invoice-content p-6 sm:p-8">
            {/* From / Bill To */}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div className="rounded-xl border border-gray-200/70 p-4">
                <h3 className="text-xs font-semibold text-gray-800 mb-1">From:</h3>
                <div className="text-sm text-gray-700 leading-6">
                  <p className="font-medium mb-0.5">944 Trafik</p>
                  <p className="mb-0.5">Frederikssund, Denmark</p>
                  <p className="mb-0.5">Phone: 26444944</p>
                  <p>Email: trafik@944.dk</p>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200/70 p-4">
                <h3 className="text-xs font-semibold text-gray-800 mb-1">Bill To:</h3>
                <div className="text-sm text-gray-700 leading-6">
                  <p className="font-medium mb-0.5">
                    {invoice.user.firstName} {invoice.user.lastName}
                  </p>
                  <p className="mb-0.5">{invoice.user.address}</p>
                  <p className="mb-0.5">Phone: {invoice.user.phone}</p>
                  <p>Email: {invoice.user.email}</p>
                </div>
              </div>
            </div>

            {/* Ride Details */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Ride Details</h3>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid sm:grid-cols-2 gap-4 p-4 bg-gray-50">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Pickup Address</p>
                    <p className="text-sm text-gray-800">{invoice.ride.pickupAddress}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Drop-off Address</p>
                    <p className="text-sm text-gray-800">{invoice.ride.dropoffAddress}</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 p-4">
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Vehicle Type</p>
                    <p className="text-sm text-gray-800">{invoice.ride.vehicleType.title}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Passengers</p>
                    <p className="text-sm text-gray-800">{invoice.ride.passengers}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">Pickup Time</p>
                    <p className="text-sm text-gray-800">
                      {new Date(invoice.ride.pickupTime).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Pricing</h3>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-600">
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    <tr>
                      <td className="px-4 py-3 text-gray-800">Taxi Service</td>
                      <td className="px-4 py-3 text-right num">{invoice.ride.price} DKK</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-500 text-[13px]">Subtotal</td>
                      <td className="px-4 py-3 text-right text-gray-500 text-[13px] num">
                        {invoice.ride.price} DKK
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-gray-500 text-[13px]">Tax (0%)</td>
                      <td className="px-4 py-3 text-right text-gray-500 text-[13px] num">0 DKK</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-semibold num">{invoice.ride.price} DKK</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Info / Status (same texts as before) */}
            {invoice.paymentStatus !== 'PAID' ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Bank Information for Payment</h3>
                <div className="text-xs text-gray-700 space-y-1">
                  <p>
                    <span className="text-gray-500">Bank Name:</span> <strong>LUNAR erhverv</strong>
                  </p>
                  <p>
                    <span className="text-gray-500">Account Number:</span> <strong>6695-2000882324</strong>
                  </p>
                  <p>
                    <span className="text-gray-500">Reference:</span>{' '}
                    <strong>INV-{invoice.invoiceNumber}</strong>
                  </p>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  Please use the invoice number as reference when making payment
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Payment Status</h3>
                <div className="text-xs text-gray-700">
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="text-green-600 font-semibold">PAID</span>
                  </p>
                  <p>
                    <span className="font-medium">Paid on:</span>{' '}
                    {new Date(invoice.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 border-t pt-3">
              <p>Thank you for choosing 944 Trafik!</p>
              <p className="mt-1">For any questions, contact us at trafik@944.dk or call 26444944</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default InvoiceClientComponent;
