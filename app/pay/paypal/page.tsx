"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PayPalPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const amount = searchParams.get("amount_dkk");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!amount) {
      setError("No amount specified");
      return;
    }
  }, [amount]);

  const handlePayPalPayment = async () => {
    if (!amount) return;

    setLoading(true);
    setError("");

    try {
      // Create PayPal payment intent
      const response = await fetch("/api/payments/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amountDkk: parseFloat(amount),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Failed to create PayPal payment");
      }

      // Redirect to PayPal approval URL
      window.location.href = data.approvalUrl;
    } catch (err: any) {
      setError(err.message || "PayPal payment failed");
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ {error}</div>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-200 rounded-xl hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Pay with PayPal</h1>

        <div className="bg-blue-50 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-900 mb-2">
              {amount} DKK
            </div>
            <div className="text-blue-600">Taxi Booking Payment</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-600 text-center">
            <strong>PayPal Payment:</strong> You'll be redirected to PayPal to complete your payment securely.
          </div>

          <div className="flex items-center justify-center space-x-4 text-gray-400">
            <div className="text-4xl">🅿️</div>
            <div>PayPal</div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={handlePayPalPayment}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Redirecting to PayPal..." : `Pay ${amount} DKK with PayPal`}
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

export default function PayPalPayment() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p>Loading PayPal payment...</p>
        </div>
      </div>
    }>
      <PayPalPaymentContent />
    </Suspense>
  );
}