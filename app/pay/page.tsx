"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";

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
  const [bookingData, setBookingData] = useState<{price: number} | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(false);
  const [hasInvoicePaymentMethod, setHasInvoicePaymentMethod] = useState(false);

  const [method, setMethod] = useState<string|null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch booking data if bookingId is provided
        if (bookingId) {
          setLoadingBooking(true);
          const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
            credentials: 'include'
          });
          if (bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            if (bookingData.ride) {
              setBookingData({ price: bookingData.ride.price });
              // التحقق من طريقة الدفع في قاعدة البيانات
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
        // Fetch invoice data if invoiceId is provided
        else if (invoiceId && !amount) {
          setLoadingBooking(true);
          const invoiceResponse = await fetch(`/api/invoices/${invoiceId}/data`, {
            credentials: 'include'
          });
          if (invoiceResponse.ok) {
            const invoiceData = await invoiceResponse.json();
            if (invoiceData.invoice && invoiceData.invoice.ride) {
              setBookingData({ price: invoiceData.invoice.ride.price });
              // التحقق من طريقة الدفع في قاعدة البيانات
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

        // Fetch payment methods
        const response = await fetch('/api/payments/methods');
        const data = await response.json();
        if (data.success) {
          setPaymentMethods(data.paymentMethods);
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
    const paymentAmount = bookingData?.price || (amount ? parseInt(amount) : 0);
    
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
            alert('🎉 تم إنشاء الفاتورة بنجاح! سيتم توجيهك إلى صفحة الحجز.');
            router.push(`/bookings/${bookingId}?payment=invoice`);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'خطأ غير محدد' }));
            console.error('❌ خطأ في تحديث طريقة الدفع:', errorData);
            alert(`❌ خطأ في إنشاء الفاتورة: ${errorData.error || 'خطأ غير محدد'}`);
          }
        } catch (networkError) {
          console.error('❌ خطأ في الشبكة:', networkError);
          alert('❌ خطأ في الشبكة. يرجى المحاولة مرة أخرى.');
        }
      } else if (invoiceId) {
        router.push(`/invoices/${invoiceId}?payment=invoice`);
      } else {
        router.push(`/book?payment_method=invoice&amount_dkk=${encodeURIComponent(paymentAmount.toString())}`);
      }
    } else {
      // لجميع طرق الدفع الأخرى (بطاقة، كريبتو، PayPal، Revolut)
      // سيتم إنشاء فاتورة كإيصال عند نجاح الدفع
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
              {loadingBooking ? "Loading..." : (bookingData?.price || amount)} DKK
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
            // إخفاء خيار "Pay by Invoice" فقط إذا كان التحقق الآمن من قاعدة البيانات يؤكد
            // أن طريقة الدفع في الحجز هي "invoice" (يمنع التلاعب بالرابط)
            if (method.key === "invoice" && hasInvoicePaymentMethod) {
              console.log('🛡️ إخفاء خيار "Pay by Invoice" لأن الحجز تم بطريقة الدفع بالفاتورة');
              return false;
            }
            return method.isActive;
          }).map((paymentMethod) => {
            const isSelected = method === paymentMethod.key;
            let ringColor = "ring-blue-500";
            let bgColor = "bg-blue-50";

            switch (paymentMethod.key) {
              case "card":
                ringColor = "ring-blue-500";
                bgColor = "bg-blue-50";
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
                onClick={() => handlePaymentMethod(paymentMethod.key)}
                className={`rounded-2xl border p-6 text-left transition hover:shadow-md hover:scale-105 ${isSelected ? `ring-2 ${ringColor} ${bgColor}` : ""}`}
              >
                <div className="text-lg font-semibold">
                  {paymentMethod.key === "card" && "💳"}
                  {paymentMethod.key === "crypto" && "₿"}
                  {paymentMethod.key === "paypal" && "🅿️"}
                  {paymentMethod.key === "revolut" && "🏦"}
                  {paymentMethod.key === "invoice" && "📄"}
                  {paymentMethod.title}
                </div>
                <div className="text-sm text-gray-500 mt-1">{paymentMethod.description}</div>
                <div className="text-xs text-gray-400 mt-2">
                  {paymentMethod.key === "card" && "Secure payment through Stripe or Revolut"}
                  {paymentMethod.key === "crypto" && "Direct wallet payments"}
                  {paymentMethod.key === "paypal" && "Secure PayPal checkout"}
                  {paymentMethod.key === "revolut" && "European banking integration"}
                  {paymentMethod.key === "invoice" && "Payment by invoice (requires approval)"}
                </div>
                <div className="text-xs text-green-600 mt-1 font-medium">
                  {paymentMethod.key === "card" && "✓ Instant processing"}
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
        Your booking will be confirmed only after successful payment.
      </div>
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
