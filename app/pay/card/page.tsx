"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CardPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking_id");

  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    console.log("CardPayment: Initializing payment", { bookingId });

    if (!bookingId) {
      console.error("CardPayment: No booking ID specified");
      setError("No booking specified");
      setLoading(false);
      return;
    }

    const initializePayment = async () => {
      try {
        console.log("CardPayment: Fetching booking details");

        // Fetch booking details to get the amount
        const bookingResponse = await fetch(`/api/bookings/${bookingId}`, {
          credentials: "include",
        });

        if (!bookingResponse.ok) {
          throw new Error("Failed to fetch booking details");
        }

        const bookingData = await bookingResponse.json();
        console.log("CardPayment: Booking data received", bookingData);

        // The API returns { ok: true, ride: {...} }
        const rideData = bookingData.ride || bookingData;
        const bookingAmount = rideData.price?.toString();

        if (!bookingAmount) {
          console.error("CardPayment: Booking amount not found in data", bookingData);
          throw new Error("Booking amount not found");
        }

        console.log("CardPayment: Booking amount", bookingAmount);
        setAmount(bookingAmount);
      } catch (err: any) {
        console.error("CardPayment: Payment initialization failed", err);
        setError(err.message || "Payment initialization failed");
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [bookingId]);

  const handlePayment = async () => {
    if (!bookingId || !amount) return;

    setLoading(true);
    setError("");

    try {
      // Confirm mock payment with the API
      console.log("CardPayment: Processing mock payment");
      const confirmResponse = await fetch('/api/payments/card/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentIntentId: `pi_mock_${Date.now()}_success` })
      });

      if (confirmResponse.ok) {
        console.log("CardPayment: Mock payment confirmed, redirecting");
        router.push(`/pay/card/success?mock=true&booking_id=${bookingId}`);
      } else {
        throw new Error('Mock payment confirmation failed');
      }
    } catch (err: any) {
      console.error("CardPayment: Payment failed", err);
      setError(err.message || "Payment failed");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Setting up secure payment</h2>
            <p className="text-gray-600">Please wait while we initialize your payment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-xl font-semibold text-red-700 mb-2">Payment Setup Failed</h2>
              <p className="text-red-600">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors"
              >
                🔄 Try Again
              </button>
              <button
                onClick={() => router.back()}
                className="block w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-colors"
              >
                ← Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Complete Your Payment</h1>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {amount} DKK
            </div>
            <div className="text-gray-600">Taxi Booking Payment</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <strong>Secure Payment:</strong> Your payment information is encrypted and processed securely.
          </div>

          <div className="flex items-center justify-center space-x-4 text-gray-400">
            <div className="text-2xl">💳</div>
            <div>Visa • Mastercard • American Express</div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full bg-black text-white py-4 px-6 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : `Pay ${amount} DKK (Mock Payment)`}
          </button>

          <button
            onClick={() => router.back()}
            className="w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-xl hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500 text-center">
          By completing this payment, you agree to our terms of service and privacy policy.
        </div>
      </div>
    </div>
  );
}

export default function CardPayment() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading payment...</p>
        </div>
      </div>
    }>
      <CardPaymentContent />
    </Suspense>
  );
}
