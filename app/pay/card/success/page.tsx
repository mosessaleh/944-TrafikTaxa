"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");
  const isMock = searchParams.get("mock") === "true";
  const bookingId = searchParams.get("booking_id");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [amount, setAmount] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const invoiceId = searchParams.get("invoice_id");

  useEffect(() => {
    // Handle mock payments for admin users
    if (isMock) {
      // For mock payments, calculate the correct amount (including late fees for invoices)
      const fetchPaymentAmount = async () => {
        let resolvedAmount: number | null = null;

        if (invoiceId) {
          // If we have an invoice ID, fetch invoice data and calculate total including late fees
          try {
            const invoiceResponse = await fetch(`/api/invoices/${invoiceId}/data`, {
              credentials: "include",
            });
            if (invoiceResponse.ok) {
              const invoiceData = await invoiceResponse.json();
              if (invoiceData.invoice) {
                const baseAmount = invoiceData.invoice.ride?.price || 0;
                const lateFee1 = invoiceData.invoice.lateFee1 || 0;
                const lateFee2 = invoiceData.invoice.lateFee2 || 0;
                resolvedAmount = baseAmount + lateFee1 + lateFee2;
                console.log("PaymentSuccess: Calculated total amount including late fees", {
                  baseAmount,
                  lateFee1,
                  lateFee2,
                  totalAmount: resolvedAmount
                });
              }
            }
          } catch (err) {
            console.warn("Could not fetch invoice data:", err);
          }
        } else if (bookingId) {
          // Fallback to booking amount if no invoice
          try {
            const response = await fetch(`/api/bookings/${bookingId}`);
            if (response.ok) {
              const data = await response.json();
              // Normalize booking shape: API may return { ride: {...} } or booking directly
              const booking = (data && typeof data === 'object' && 'ride' in data)
                ? (data as any).ride
                : data;
              if (booking && typeof (booking as any).price === "number") {
                resolvedAmount = (booking as any).price;
              }
              // Store booking details for UI / amount display
              setBookingDetails(booking);
            }
          } catch (err) {
            // ignore and keep resolvedAmount as null
          }
        }

        if (resolvedAmount !== null) {
          setAmount(resolvedAmount.toString());
        } else {
          // If we can't determine the amount reliably, leave it empty and only show generic success text
          setAmount("");
        }

        setStatus("success");
      };
      fetchPaymentAmount();
      return;
    }

    if (!paymentIntent) {
      setStatus("error");
      return;
    }

    const confirmPayment = async () => {
      try {
        const response = await fetch("/api/payments/card/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ paymentIntentId: paymentIntent }),
        });

        const data = await response.json();

        if (response.ok && data.ok) {
          setStatus("success");
          setAmount(data.amount?.toString() || "");

          // Fetch booking details for notifications
          if (bookingId) {
            try {
              const bookingResponse = await fetch(`/api/bookings/${bookingId}`);
              if (bookingResponse.ok) {
                const booking = await bookingResponse.json();
                setBookingDetails(booking);

                // Send success notification
                if (!notificationSent) {
                  await sendPaymentNotification(booking, data.amount);
                  setNotificationSent(true);
                }
              }
            } catch (bookingErr) {
              console.warn("Could not fetch booking details for notification:", bookingErr);
            }
          }
        } else {
          setStatus("error");
        }
      } catch (err) {
        setStatus("error");
      }
    };

    const sendPaymentNotification = async (booking: any, amount: number) => {
      try {
        // Send email notification
        await fetch("/api/bookings/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bookingId: booking.id,
            paymentAmount: amount,
            paymentMethod: "card"
          }),
        });

        // Browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Payment Successful! 🎉', {
            body: `Your taxi booking for ${amount} DKK has been confirmed.`,
            icon: '/logo.svg'
          });
        }
      } catch (err) {
        console.warn("Could not send payment notification:", err);
      }
    };

    confirmPayment();
  }, [paymentIntent, isMock]);

  const bookingInfo = bookingDetails && (bookingDetails as any).ride
    ? (bookingDetails as any).ride
    : bookingDetails;

  const isScheduledBooking = Boolean((bookingInfo as any)?.scheduled);
  const primaryActionHref = isScheduledBooking || !bookingId
    ? "/bookings"
    : `/waiting-for-driver?bookingId=${bookingId}`;
  const primaryActionLabel = isScheduledBooking
    ? "📅 View Bookings"
    : "🚗 Waiting for Driver";

  // Determine the amount to display in the message: prefer calculated amount for invoices, fallback to booking price
  const displayAmount =
    invoiceId && amount
      ? Number(amount) // For invoice payments, use the calculated amount (includes late fees)
      : bookingInfo && typeof (bookingInfo as any).price === "number"
      ? (bookingInfo as any).price
      : amount
      ? Number(amount)
      : undefined;

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Confirming Payment</h2>
            <p className="text-gray-600 mb-4">Please wait while we verify your payment...</p>
            <div className="bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full animate-pulse w-2/3"></div>
            </div>
            <p className="text-sm text-gray-500 mt-4">This may take a few moments</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-4">Payment Verification Failed</h1>
          <p className="text-gray-600 mb-6">
            We couldn't verify your payment. Please contact support if you were charged.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pay")}
              className="block w-full bg-black text-white py-3 px-6 rounded-xl hover:bg-gray-800"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push("/")}
              className="block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-300"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <div className="text-green-600 text-6xl mb-4 animate-bounce-in">✅</div>
          <h1 className="text-2xl font-bold mb-4 text-green-800">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            {displayAmount !== undefined
              ? (
                <>
                  Your payment of <strong className="text-green-700">{displayAmount} DKK</strong> has been processed successfully.
                </>
              )
              : (
                <>Your payment has been processed successfully.</>
              )}
          {isMock && <span className="text-orange-600 font-semibold block mt-2">(Mock Payment - Admin Mode)</span>}
          </p>

          {bookingInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Booking Details</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p><strong>From:</strong> {bookingInfo.pickupAddress}</p>
                {bookingInfo.stopAddress && (
                  <p><strong>Stop:</strong> {bookingInfo.stopAddress}</p>
                )}
                <p><strong>To:</strong> {bookingInfo.dropoffAddress}</p>
                <p><strong>Time:</strong> {new Date(bookingInfo.pickupTime).toLocaleString()}</p>
                <p><strong>Status:</strong> <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">{bookingInfo.status}</span></p>
              </div>
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="text-green-800">
              <div className="font-semibold mb-3 flex items-center gap-2">
                <span>📧</span>
                Notifications Sent
              </div>
              <ul className="text-left space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Confirmation email sent to your inbox
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  SMS notification sent (if phone provided)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  Dispatcher notified for driver assignment
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="text-yellow-800">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <span>🚗</span>
                What's Next?
              </div>
              <ul className="text-left space-y-1 text-sm">
                <li>• Driver will be assigned within 15 minutes</li>
                <li>• You'll receive driver details via SMS</li>
                <li>• Track your ride in real-time on the app</li>
                <li>• Rate your experience after the ride</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => router.push(primaryActionHref)}
              className="block w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            >
              {primaryActionLabel}
            </button>
            <button
              onClick={() => router.push("/")}
              className="block w-full bg-gray-100 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors"
            >
              🏠 Book Another Ride
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
