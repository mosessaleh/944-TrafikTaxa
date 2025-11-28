"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import PaymentMethodsClient from "@/components/payment-methods-client";

interface PaymentMethod {
  id: number;
  key: string;
  title: string;
  description: string;
  isActive: boolean;
}

function PayIndexContent(){
  const router = useRouter();
  const sp = useSearchParams();
  const invoiceId = sp.get("invoice") || "";
  const bookingId = sp.get("booking") || sp.get("booking_id") || "";
  const amount = sp.get("amount_dkk") || "";


  // State for booking data
  const [bookingData, setBookingData] = useState<{ price: number; scheduled?: boolean; pickupTime?: string | null } | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [hasInvoicePaymentMethod, setHasInvoicePaymentMethod] = useState(false);
  const [userCanPayByInvoice, setUserCanPayByInvoice] = useState(false);

  const [method, setMethod] = useState<string|null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPaymentMethods, setUserPaymentMethods] = useState<any[]>([]);
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Priority: Invoice data takes precedence over booking data for accurate amounts
        if (invoiceId) {
          setLoadingBooking(true);
          const invoiceResponse = await fetch(`/api/invoices/${invoiceId}/data`, {
            credentials: 'include'
          });
          if (invoiceResponse.ok) {
            const invoiceData = await invoiceResponse.json();
            if (invoiceData.invoice && invoiceData.invoice.ride) {
              // Calculate total amount including late fees for invoices
              const baseAmount = invoiceData.invoice.ride.price;
              const lateFee1 = invoiceData.invoice.lateFee1 || 0;
              const lateFee2 = invoiceData.invoice.lateFee2 || 0;
              const totalAmount = baseAmount + lateFee1 + lateFee2;

              setBookingData({
                price: totalAmount, // Always use calculated total for invoices (includes late fees)
                scheduled: invoiceData.invoice.ride.scheduled,
                pickupTime: invoiceData.invoice.ride.pickupTime,
              });
              // Verify payment method stored in the database
              setHasInvoicePaymentMethod(invoiceData.invoice.ride.paymentMethod === 'invoice');
            }
          } else if (invoiceResponse.status === 401) {
            alert('Please log in to continue.');
            router.push('/login');
            return;
          } else if (invoiceResponse.status === 404) {
            alert('Invoice not found.');
            router.push('/account?tab=invoices');
            return;
          } else {
            alert('You do not have permission to access this invoice.');
            router.push('/account?tab=invoices');
            return;
          }
          setLoadingBooking(false);
        }
        // Fetch booking data only if no invoiceId (for regular bookings)
        else if (bookingId) {
          setLoadingBooking(true);
          const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
            credentials: 'include'
          });
          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            if (bookingData.ride) {
              setBookingData({
                price: bookingData.ride.price,
                scheduled: bookingData.ride.scheduled,
                pickupTime: bookingData.ride.pickupTime,
              });
              // Verify payment method stored in the database
              setHasInvoicePaymentMethod(bookingData.ride.paymentMethod === 'invoice');
            }
          } else if (bookingResponse.status === 401) {
            alert('Please log in to continue.');
            router.push('/login');
            return;
          } else if (bookingResponse.status === 404) {
            alert('Booking not found.');
            router.push('/');
            return;
          } else {
            alert('You do not have permission to access this booking.');
            router.push('/');
            return;
          }
          setLoadingBooking(false);
        }

        // Fetch user profile to check canPayByInvoice permission
        const profileResponse = await fetch('/api/profile', {
          credentials: 'include'
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const canPayByInvoice = profileData.me?.canPayByInvoice || false;
          console.log('User can pay by invoice:', canPayByInvoice);
          setUserCanPayByInvoice(canPayByInvoice);
        }

        // Fetch payment methods
        const response = await fetch('/api/payments/methods');
        const data = await response.json();
        if (data.success) {
          setPaymentMethods(data.paymentMethods);
        }

        // Fetch user payment methods
        const userMethodsResponse = await fetch('/api/user/payment-methods', {
          credentials: 'include'
        });
        if (userMethodsResponse.ok) {
          const userMethodsData = await userMethodsResponse.json();
          if (userMethodsData.success) {
            setUserPaymentMethods(userMethodsData.paymentMethods || []);
          }
        }
      } catch (error) {
        console.error('Error fetching payment data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, invoiceId, amount]);

  const handlePaymentMethod = async (selectedMethod: string) => {
    if (!bookingId && !invoiceId && !amount) {
      alert("No payment information found. Please go back and try again.");
      return;
    }

    setMethod(selectedMethod);

    // Use booking price from database if available, otherwise use URL parameter
    const paymentAmount = bookingData?.price || (amount ? parseFloat(amount) : 0);
    
    // Build query parameters
    const params = new URLSearchParams();
    if (bookingId) params.set('booking_id', bookingId);
    if (invoiceId) params.set('invoice_id', invoiceId);
    if (paymentAmount > 0) params.set('amount_dkk', paymentAmount.toString());

    if (selectedMethod === "invoice") {
      // Handle invoice payment only for invoice method
      console.log('💰 Processing invoice payment...');
      
      if (bookingId) {
        try {
          console.log('📝 Updating booking with invoice payment method...');
          const response = await fetch(`/api/bookings/${bookingId}/payment-method`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod: 'invoice' })
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Invoice payment method updated successfully:', result);
            alert('🎉 Invoice created successfully! You will be redirected to the booking page.');
            router.push(`/bookings/${bookingId}?payment=invoice`);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('❌ Error updating payment method:', errorData);
            alert(`❌ Error creating invoice: ${errorData.error || 'Unknown error'}`);
          }
        } catch (networkError) {
          console.error('❌ Network error:', networkError);
          alert('❌ Network error. Please try again.');
        }
      } else if (invoiceId) {
        router.push(`/invoices/${invoiceId}?payment=invoice`);
      } else {
        router.push(`/book?payment_method=invoice&amount_dkk=${encodeURIComponent(paymentAmount.toString())}`);
      }
    } else {
      // For all other payment methods (card, crypto, PayPal, Revolut)
      // an invoice will be created as a receipt after successful payment
      router.push(`/pay/${selectedMethod}?${params.toString()}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 grid gap-6">
      <h1 className="text-2xl font-bold">Choose Payment Method</h1>

      {(bookingData || amount) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-900">Amount to Pay</div>
            <div className="text-2xl font-bold text-blue-800">
              {loadingBooking ? "Loading..." : (bookingData?.price ? bookingData.price.toFixed(2) : (amount || "0"))} DKK
            </div>
            {bookingId && (
              <div className="text-sm text-blue-600 mt-1">Booking #{bookingId}</div>
            )}
            {invoiceId && !bookingId && (
              <div className="text-sm text-blue-600 mt-1">Invoice #{invoiceId}</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading payment methods...</div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.filter(method => {
            // Show "Pay by Invoice" if user has permission, but hide it if the booking already uses invoice payment method
            if (method.key === "invoice") {
              if (!userCanPayByInvoice) {
                console.log('🛡️ Hiding "Pay by Invoice" because user does not have permission');
                return false;
              }
              if (hasInvoicePaymentMethod) {
                console.log('🛡️ Hiding "Pay by Invoice" because the booking already uses invoice payment method');
                return false;
              }
            }
            if (!method.isActive) return false;
            // Hide crypto when it is not allowed for the current booking context
            if (method.key === "crypto") {
              // Allow crypto for:
              // 1. Invoice payments (when invoiceId is present), OR
              // 2. Scheduled bookings with pickup at least 1h from now
              if (invoiceId) {
                // For invoice payments, crypto is always allowed
                return true;
              } else {
                // For regular bookings, only allow crypto for scheduled bookings with pickup at least 1h from now
                if (!bookingId) return false;
                if (!bookingData) return false;
                if (bookingData.scheduled !== true) return false;
                if (!bookingData.pickupTime) return false;
                const pickup = new Date(bookingData.pickupTime);
                if (Number.isNaN(pickup.getTime())) return false;
                const now = new Date();
                const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
                if (!(pickup > oneHourFromNow)) return false;
              }
            }
            return true;
          }).map((paymentMethod) => {
            const isSelected = method === paymentMethod.key;
            let ringColor = "ring-blue-500";
            let bgColor = "bg-blue-50";
            let isDisabled = false;

            switch (paymentMethod.key) {
              case "card":
                // Check if user has saved card payment methods
                const hasSavedCards = userPaymentMethods.filter((pm: any) => pm.type === 'card' && pm.isActive).length > 0;
                if (!hasSavedCards) {
                  isDisabled = true;
                  ringColor = "ring-amber-500";
                  bgColor = "bg-amber-50";
                } else {
                  ringColor = "ring-blue-500";
                  bgColor = "bg-blue-50";
                }
                break;
              case "crypto":
                ringColor = "ring-orange-500";
                bgColor = "bg-orange-50";
                break;
              case "paypal":
                ringColor = "ring-blue-600";
                bgColor = "bg-blue-50";
                break;
              case "revolut":
                ringColor = "ring-green-500";
                bgColor = "bg-green-50";
                break;
              case "invoice":
                ringColor = "ring-purple-500";
                bgColor = "bg-purple-50";
                break;
            }

            return (
              <button
                key={paymentMethod.key}
                onClick={() => {
                  if (paymentMethod.key === 'card' && isDisabled) {
                    setShowAddCardModal(true);
                  } else {
                    handlePaymentMethod(paymentMethod.key);
                  }
                }}
                disabled={isDisabled}
                className={`rounded-2xl border p-6 text-left transition hover:shadow-md hover:scale-105 ${
                  isSelected ? `ring-2 ${ringColor} ${bgColor}` : ""
                } ${
                  isDisabled ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <div className="text-lg font-semibold">
                  {paymentMethod.key === "card" && "💳"}
                  {paymentMethod.key === "crypto" && "₿"}
                  {paymentMethod.key === "paypal" && "🅿️"}
                  {paymentMethod.key === "revolut" && "🏦"}
                  {paymentMethod.key === "invoice" && "📄"}
                  {paymentMethod.title}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {paymentMethod.key === "card" && isDisabled
                    ? "Add a card to your profile to use this payment method"
                    : paymentMethod.description
                  }
                  {paymentMethod.key === "crypto" && paymentMethod.description}
                  {paymentMethod.key === "paypal" && paymentMethod.description}
                  {paymentMethod.key === "revolut" && paymentMethod.description}
                  {paymentMethod.key === "invoice" && paymentMethod.description}
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  {paymentMethod.key === "card" && !isDisabled && "Secure payment through Stripe or Revolut"}
                  {paymentMethod.key === "card" && isDisabled && "Click to add your first card"}
                  {paymentMethod.key === "crypto" && "Direct wallet payments"}
                  {paymentMethod.key === "paypal" && "Secure PayPal checkout"}
                  {paymentMethod.key === "revolut" && "European banking integration"}
                  {paymentMethod.key === "invoice" && "Payment by invoice (requires approval)"}
                </div>
                <div className={`text-xs mt-1 font-medium ${
                  paymentMethod.key === "card" && isDisabled ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {paymentMethod.key === "card" && !isDisabled && "✓ Instant processing"}
                  {paymentMethod.key === "card" && isDisabled && "⚠️ Card required"}
                  {paymentMethod.key === "crypto" && "✓ Lower fees"}
                  {paymentMethod.key === "paypal" && "✓ Buyer protection"}
                  {paymentMethod.key === "revolut" && "✓ Bank-grade security"}
                  {paymentMethod.key === "invoice" && "✓ Pay later"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="text-center text-sm text-gray-600">
        Payment will be collected automatically after trip completion.
      </div>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Payment Method</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add a card to enable instant payments after trip completion.
              </p>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowAddCardModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl"
                aria-label="Close"
              >
                ×
              </button>
              <PaymentMethodsClient />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PayIndex(){
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto p-6"><div className="text-center">Loading...</div></div>}>
      <PayIndexContent />
    </Suspense>
  );
}
